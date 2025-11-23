from collections.abc import Callable
from datetime import datetime
from pathlib import Path
import re
from typing import Any, Literal, TypeAlias, TypedDict, cast
import warnings

from dateutil import parser
import numpy as np
import pandas as pd
from pandas._libs.tslibs.nattype import NaTType

warnings.filterwarnings("ignore", category=pd.errors.PerformanceWarning)

DataFrame: TypeAlias = pd.DataFrame

LEAD_TIME_THRESHHOLD = 185
FIRST_FORMULA_ROUND_DECIMALS = 10


class RuntimeContext(TypedDict):
    ref_date: pd.Timestamp
    current_year: int
    current_month: int
    current_quarter: int
    current_month_str: str
    current_period: str
    current_period_tm: str


DEFAULT_LONG_AGE_COLUMN = "long aged"
LONG_AGE_COLUMN = DEFAULT_LONG_AGE_COLUMN
LONG_AGE_FLAG_VALUE = f"Y{LONG_AGE_COLUMN}"

_DATE_SPLIT_PATTERN = re.compile(r"[^\d]")
_NUMERIC_DATE_PATTERN = re.compile(r"^[\d\s./-]+$")
_NULL_DATE_STRINGS = {"", "nan", "nat", "none", "null", "<na>", "n/a"}


def _parse_target_month(value: str | None) -> pd.Timestamp:
    if not value:
        now = pd.Timestamp.now()
        if now.month == 1:
            start = pd.Timestamp(year=now.year - 1, month=12, day=1)
        else:
            start = pd.Timestamp(year=now.year, month=now.month - 1, day=1)
        return cast(pd.Timestamp, start)

    text = value.strip()
    for fmt in ("%Y-%m", "%Y/%m", "%Y%m"):
        try:
            parsed = datetime.strptime(text, fmt)
            start = pd.Timestamp(year=parsed.year, month=parsed.month, day=1)
            return cast(pd.Timestamp, start)
        except ValueError:
            continue

    parsed_ts = pd.to_datetime(text, errors="coerce")
    if pd.isna(parsed_ts):
        raise ValueError(f"Invalid target_month value: {value!r}")
    start = pd.Timestamp(year=parsed_ts.year, month=parsed_ts.month, day=1)
    return cast(pd.Timestamp, start)


def _build_runtime_context(target_month: str | None) -> RuntimeContext:
    month_start = _parse_target_month(target_month)
    current_year = month_start.year
    current_month = month_start.month
    current_quarter = ((current_month - 1) // 3) + 1
    current_month_str = month_start.strftime("%y%m")
    ref_date = month_start + pd.offsets.MonthEnd(0)
    current_period = current_month_str + "A"
    current_period_tm = month_start.strftime("%Y-%m")
    return RuntimeContext(
        ref_date=ref_date,
        current_year=current_year,
        current_month=current_month,
        current_quarter=current_quarter,
        current_month_str=current_month_str,
        current_period=current_period,
        current_period_tm=current_period_tm,
    )


def _initialize_long_age_defaults(runtime_ctx: RuntimeContext) -> None:
    global DEFAULT_LONG_AGE_COLUMN, LONG_AGE_COLUMN, LONG_AGE_FLAG_VALUE
    current_year = runtime_ctx["current_year"]
    DEFAULT_LONG_AGE_COLUMN = f"{(current_year - 1) % 100:02d} long aged"
    LONG_AGE_COLUMN = DEFAULT_LONG_AGE_COLUMN
    LONG_AGE_FLAG_VALUE = f"Y{LONG_AGE_COLUMN}"


def _extract_payterm_col(s, idx):
    return s.apply(
        lambda v: [x.strip() for x in str(v).split(";") if x.strip()] if pd.notna(v) else []
    ).str[idx]


def _coerce_date_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in _NULL_DATE_STRINGS:
        return None
    return text


def _parse_with_pandas(text: str) -> pd.Timestamp | NaTType | None:
    parsed = pd.to_datetime(text, errors="coerce")
    if pd.isna(parsed):
        return None
    return pd.Timestamp(parsed)


def _parse_numeric_date(text: str) -> pd.Timestamp | NaTType | None:
    if not _NUMERIC_DATE_PATTERN.fullmatch(text):
        return None

    normalized = text.replace(".", "/").replace("-", "/").replace(" ", "/").replace("//", "/")
    parts = [p for p in normalized.split("/") if p]
    if len(parts) != 3:
        return pd.NaT

    try:
        numbers = [int(part) for part in parts]
    except ValueError:
        return pd.NaT

    candidates: list[tuple[int, int, int]] = []
    if len(parts[0]) == 4:
        candidates.append((numbers[0], numbers[1], numbers[2]))
    if len(parts[2]) == 4:
        candidates.append((numbers[2], numbers[0], numbers[1]))

    if not candidates:
        return pd.NaT

    for year, month, day in candidates:
        try:
            return pd.Timestamp(datetime(year, month, day))
        except ValueError:
            continue

    return pd.NaT


def _parse_with_dateutil(normalized: str) -> pd.Timestamp | NaTType | None:
    for dayfirst in (False, True):
        try:
            parsed = parser.parse(normalized, dayfirst=dayfirst)
            return pd.Timestamp(parsed)
        except (ValueError, parser.ParserError, TypeError):
            continue
    return None


def _parse_from_components(normalized: str) -> pd.Timestamp | NaTType | None:
    parts = [p for p in _DATE_SPLIT_PATTERN.split(normalized) if p]
    if len(parts) != 3:
        return None

    candidates: list[tuple[int, int, int]] = []
    if len(parts[0]) == 4:
        candidates.append((int(parts[0]), int(parts[1]), int(parts[2])))
    if len(parts[2]) == 4:
        candidates.append((int(parts[2]), int(parts[0]), int(parts[1])))

    for year, month, day in candidates:
        try:
            return pd.Timestamp(datetime(year, month, day))
        except ValueError:
            continue
    return None


def _parse_mixed_datetime_value(value: object) -> pd.Timestamp | NaTType:
    if isinstance(value, (pd.Timestamp, datetime, np.datetime64)):
        return pd.Timestamp(value)

    text = _coerce_date_text(value)
    if text is None:
        return pd.NaT

    numeric_result = _parse_numeric_date(text)
    if numeric_result is not None:
        return numeric_result

    pandas_result = _parse_with_pandas(text)
    if pandas_result is not None:
        return pandas_result

    normalized = text.replace(".", "/").replace("-", "/")

    dateutil_result = _parse_with_dateutil(normalized)
    if dateutil_result is not None:
        return dateutil_result

    component_result = _parse_from_components(normalized)
    if component_result is not None:
        return component_result

    return pd.NaT


def _parse_mixed_datetime_series(series: pd.Series) -> pd.Series:
    return cast(pd.Series, series.apply(_parse_mixed_datetime_value))


def _to_numeric_fillna(series: pd.Series, fill_value: float = 0) -> pd.Series:
    """将 Series 转换为数值类型，并用指定值填充 NaN"""
    result = pd.to_numeric(series, errors="coerce")
    if isinstance(result, pd.Series):
        return result.fillna(fill_value)  # type: ignore[return-value]
    # 如果返回的不是 Series（理论上不会发生），转换为 Series
    return pd.Series(result).fillna(fill_value)  # type: ignore[arg-type]


def _to_numeric_series(
    value: Any, errors: Literal["ignore", "raise", "coerce"] = "coerce"
) -> pd.Series:
    """确保返回 pandas Series，以便进行数值计算。"""
    result = pd.to_numeric(value, errors=errors)
    if isinstance(result, pd.Series):
        return result
    return pd.Series(result)


def _prepare_manual_adjustment_maps(
    df_balance_manual: DataFrame | None,
    df_status_manual: DataFrame | None,
    df_long_age_manual: DataFrame | None,
    long_age_column: str,
) -> tuple[pd.Series | None, pd.Series | None, pd.Series | None]:
    balance_map: pd.Series | None = None
    status_map: pd.Series | None = None
    long_age_map: pd.Series | None = None

    if (
        df_balance_manual is not None
        and not df_balance_manual.empty
        and {"Contract", "Balance"}.issubset(df_balance_manual.columns)
    ):
        balance_series = df_balance_manual.set_index("Contract")["Balance"].dropna()
        if not balance_series.empty:
            balance_map = cast(pd.Series, balance_series)

    if (
        df_status_manual is not None
        and not df_status_manual.empty
        and {"Contract No", "Contract status"}.issubset(df_status_manual.columns)
    ):
        status_series = df_status_manual.set_index("Contract No")["Contract status"].dropna()
        if not status_series.empty:
            status_map = cast(pd.Series, status_series)

    if (
        df_long_age_manual is not None
        and not df_long_age_manual.empty
        and {"Contract No", long_age_column}.issubset(df_long_age_manual.columns)
    ):
        long_age_series = df_long_age_manual.set_index("Contract No")[long_age_column].dropna()
        if not long_age_series.empty:
            long_age_map = cast(pd.Series, long_age_series)

    return balance_map, status_map, long_age_map


def _load_manual_adj(
    file_path: Path, sheet_names: dict[str, str]
) -> tuple[DataFrame | None, DataFrame | None, DataFrame | None]:
    balance_df: DataFrame | None = None
    status_df: DataFrame | None = None
    long_age_df: DataFrame | None = None

    balance_sheet = sheet_names.get("balance")
    if balance_sheet:
        try:
            balance_df = pd.read_excel(file_path, sheet_name=balance_sheet)
        except ValueError:
            balance_df = None

    status_sheet = sheet_names.get("status")
    if status_sheet:
        try:
            status_df = pd.read_excel(file_path, sheet_name=status_sheet)
        except ValueError:
            status_df = None

    long_age_sheet = sheet_names.get("long_age") or sheet_names.get("long aged PO#")
    if long_age_sheet:
        try:
            long_age_df = pd.read_excel(file_path, sheet_name=long_age_sheet)
        except ValueError:
            long_age_df = None

    return balance_df, status_df, long_age_df


def _apply_manual_amt_to_add(
    contract_series: pd.Series | pd.DataFrame,
    base_series: pd.Series | pd.DataFrame,
    manual_map: pd.Series | None,
) -> pd.Series:
    contract_series = cast(pd.Series, contract_series)
    base_series = cast(pd.Series, base_series)
    if manual_map is None or manual_map.empty:
        return base_series

    overrides = contract_series.map(manual_map)
    return overrides.where(overrides.notna(), base_series)


def _apply_manual_status(
    contract_series: pd.Series | pd.DataFrame,
    manual_map: pd.Series | None,
) -> pd.Series:
    contract_series = cast(pd.Series, contract_series)
    base = pd.Series(0, index=contract_series.index, dtype="object")
    if manual_map is None or manual_map.empty:
        return base

    result = contract_series.map(manual_map)
    return result.combine_first(base)


def _apply_manual_long_age(
    contract_series: pd.Series | pd.DataFrame,
    manual_map: pd.Series | None,
) -> pd.Series:
    contract_series = cast(pd.Series, contract_series)
    if manual_map is None or manual_map.empty:
        return pd.Series(np.nan, index=contract_series.index, dtype="object")
    return cast(pd.Series, contract_series.map(manual_map))


def _detect_long_age_column(df_long_age_manual: DataFrame | None) -> str | None:
    if df_long_age_manual is None or df_long_age_manual.empty:
        return None

    for column in df_long_age_manual.columns:
        normalized = column.strip().lower()
        if normalized.endswith("long aged") and normalized not in {"long aged"}:
            return column

    for column in df_long_age_manual.columns:
        if column.strip().lower() == "long aged":
            return column

    candidates = [
        column
        for column in df_long_age_manual.columns
        if column.strip().lower() not in {"contract no", "contract"}
    ]
    return candidates[0] if candidates else None


def _set_long_age_column(column_name: str) -> None:
    global LONG_AGE_COLUMN, LONG_AGE_FLAG_VALUE
    LONG_AGE_COLUMN = column_name
    LONG_AGE_FLAG_VALUE = f"Y{LONG_AGE_COLUMN}"


def get_long_age_cols() -> list[str]:
    return [
        "Period",
        "BD",
        "Province",
        "Contract No",
        "Contract Name",
        "Category 1",
        "Category 2",
        "5GC or not",
        "CPM",
        "Reason",
        "Amt to add-Total",
        "DEL amt to add",
        "PAC amt to add",
        "FAC amt to add",
        LONG_AGE_COLUMN,
    ]


def _build_target_mapping(df_target: DataFrame) -> dict[str, object] | None:
    if {"Contract No.", "Q4F9RES"}.issubset(df_target.columns):
        target_series = df_target.set_index("Contract No.")["Q4F9RES"].dropna()
        if not target_series.empty:
            return cast(dict[str, object], target_series.to_dict())
    return None


def _build_last_month_maps(
    df_raw_data_last_month: DataFrame,
) -> tuple[dict[int, dict[str, object]], dict[int, dict[str, object]]]:
    target_maps: dict[int, dict[str, object]] = {}
    balance_maps: dict[int, dict[str, object]] = {}

    if "Contract No" not in df_raw_data_last_month.columns:
        return target_maps, balance_maps

    last_month_indexed = df_raw_data_last_month.set_index("Contract No")
    for quarter in range(1, 5):
        target_col = f"Q{quarter} Target"
        if target_col in last_month_indexed.columns:
            target_series = cast(pd.Series, last_month_indexed[target_col]).dropna()
            if not target_series.empty:
                target_maps[quarter] = cast(dict[str, object], target_series.to_dict())

        balance_col = f"Q{quarter} Target balance"
        if balance_col in last_month_indexed.columns:
            balance_series = cast(pd.Series, last_month_indexed[balance_col]).dropna()
            if not balance_series.empty:
                balance_maps[quarter] = cast(dict[str, object], balance_series.to_dict())

    return target_maps, balance_maps


def _map_contract_series(
    contract_series: pd.Series, mapping: dict[str, object] | None
) -> pd.Series:
    if mapping is None:
        return pd.Series(np.nan, index=contract_series.index, dtype="float64")
    return cast(pd.Series, contract_series.map(mapping))  # type: ignore[arg-type]


def _select_quarter_mapping(
    quarter: int,
    current_quarter_value: int,
    current_mapping: dict[str, object] | None,
    fallback_maps: dict[int, dict[str, object]],
) -> dict[str, object] | None:
    if quarter == current_quarter_value and current_mapping is not None:
        return current_mapping
    return fallback_maps.get(quarter)


def _map_target_column(
    df_assign: DataFrame,
    quarter: int,
    current_quarter_value: int,
    current_mapping: dict[str, object] | None,
    fallback_maps: dict[int, dict[str, object]],
) -> pd.Series:
    contract_series = cast(pd.Series, df_assign["Contract No"])
    mapping = _select_quarter_mapping(
        quarter, current_quarter_value, current_mapping, fallback_maps
    )
    return _map_contract_series(contract_series, mapping)


def _map_last_month_series(
    df_assign: DataFrame,
    last_month_indexed: DataFrame | None,
    column_name: str,
) -> pd.Series:
    if last_month_indexed is None or column_name not in last_month_indexed.columns:
        return pd.Series(np.nan, index=df_assign.index)
    contract_series = cast(pd.Series, df_assign["Contract No"])
    mapping_series = cast(pd.Series, last_month_indexed[column_name])
    return cast(pd.Series, contract_series.map(mapping_series))


def _map_last_month_numeric(
    df_assign: DataFrame,
    last_month_indexed: DataFrame | None,
    column_name: str,
) -> pd.Series:
    series = _map_last_month_series(df_assign, last_month_indexed, column_name)
    result = pd.to_numeric(series, errors="coerce")
    return cast(pd.Series, result)


def _build_target_lambda(
    quarter: int,
    current_quarter_value: int,
    target_mapping: dict[str, object] | None,
    fallback_maps: dict[int, dict[str, object]],
) -> Callable[[DataFrame], pd.Series]:
    def _inner(df_assign: DataFrame) -> pd.Series:
        return _map_target_column(
            df_assign,
            quarter,
            current_quarter_value,
            target_mapping,
            fallback_maps,
        )

    return _inner


def _build_target_balance_lambda(
    quarter: int,
    current_quarter_value: int,
    target_mapping: dict[str, object] | None,
    fallback_maps: dict[int, dict[str, object]],
) -> Callable[[DataFrame], pd.Series]:
    landing_col = f"Q{quarter} landing"

    def _inner(df_assign: DataFrame) -> pd.Series:
        has_current_target = quarter == current_quarter_value and target_mapping is not None
        if has_current_target:
            return _to_numeric_series(df_assign[f"Q{quarter} Target"]).subtract(
                _to_numeric_series(df_assign[landing_col])
            )

        contract_series = cast(pd.Series, df_assign["Contract No"])
        mapping = _select_quarter_mapping(
            quarter, current_quarter_value, target_mapping, fallback_maps
        )
        return _map_contract_series(contract_series, mapping)

    return _inner


def _apply_assignments(df_initial: DataFrame, assignments: list[dict[str, Any]]) -> DataFrame:
    df_result = df_initial
    for assignment in assignments:
        df_result = df_result.assign(**assignment)
    return df_result


def process_first_formula(
    df_combo_current: DataFrame,
    df_combo_pre: DataFrame,
    df_acc_collection: DataFrame,
    df_pft: DataFrame,
    df_target: DataFrame,
    df_raw_data_last_month: DataFrame,
    runtime_ctx: RuntimeContext,
    manual_balance_map: pd.Series | None = None,
    manual_status_map: pd.Series | None = None,
    manual_long_age_map: pd.Series | None = None,
) -> DataFrame:
    combo_pre_indexed = df_combo_pre.set_index("CCLM ID")
    pft_indexed = df_pft.set_index("Contract No.")
    acc_collection_indexed = df_acc_collection.set_index("CCLMID")

    last_month_indexed = (
        df_raw_data_last_month.set_index("Contract No")
        if "Contract No" in df_raw_data_last_month.columns
        else None
    )

    target_mapping = _build_target_mapping(df_target)
    (
        last_month_target_maps,
        last_month_balance_maps,
    ) = _build_last_month_maps(df_raw_data_last_month)

    ref_date = runtime_ctx["ref_date"]
    current_year = runtime_ctx["current_year"]
    current_quarter = runtime_ctx["current_quarter"]

    dac_previous_series = _parse_mixed_datetime_series(
        cast(pd.Series, combo_pre_indexed["Dac Date Provious"])
    )
    pac_previous_series = _parse_mixed_datetime_series(
        cast(pd.Series, combo_pre_indexed["Pac/CO Date Provious"])
    )
    fac_previous_series = _parse_mixed_datetime_series(
        cast(pd.Series, combo_pre_indexed["Fac Date Provious"])
    )

    unbilled_series = cast(pd.Series, pft_indexed["Unbilled Total"])
    billed_total_series = cast(pd.Series, pft_indexed["Billed Total"])
    billed_not_due_series = cast(pd.Series, pft_indexed["Billed Not Due"])
    billed_overdue_series = cast(pd.Series, pft_indexed["Billed Overdue"])
    payment_term_series = cast(pd.Series, pft_indexed[">PaymentTerm"])
    billed_del_series = cast(pd.Series, pft_indexed["Billed Del"])
    billed_pac_series = cast(pd.Series, pft_indexed["Billed PAC"])
    billed_fac_series = cast(pd.Series, pft_indexed["Billed FAC"])
    billed_act_series = cast(pd.Series, pft_indexed["Billed ACT"])
    total_ar_series = cast(pd.Series, pft_indexed["Total AR"])
    acc_collection_series = cast(pd.Series, acc_collection_indexed["Collection"])

    pd_creation_date_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["PD Creation Date"])
    )
    es_approved_date_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["ES Approved Date"])
    )
    signed_date_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["Signed Date"])
    )
    first_delivery_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["First Delivery Date"])
    )
    last_oa_date_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["Last OA Date"])
    )
    last_pod_date_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["Last POD Date"])
    )
    del_date_current_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["Dac Date Current"])
    )
    del_date_actual_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["Dac Date Actual"])
    )
    pac_baseline_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["Pac Baseline"])
    )
    pac_date_current_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["Pac/CO Date Current"])
    )
    pac_date_actual_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["Pac/CO Date Actual"])
    )
    fac_baseline_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["FAC Baseline"])
    )
    fac_date_current_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["Fac Date Current"])
    )
    fac_date_actual_series = _parse_mixed_datetime_series(
        cast(pd.Series, df_combo_current["Fac Date Actual"])
    )

    base_assignments: dict[str, Any] = {
        "Period": (
            lambda x: pd.Series(runtime_ctx["current_period"], index=df_combo_current.index)
        ),
        "Contract No": df_combo_current["CCLM ID"],
        "Contract Name": df_combo_current["Contract Name"],
        "Contract Type": df_combo_current["Contract Type"],
        "Mark": df_combo_current["Mark"],
        "Category 1": df_combo_current["Category 1"],
        "Category 2": df_combo_current["Category 2"],
        "Previous Version Mark": df_combo_current["Previous Version Mark"],
        "Category(FA)": df_combo_current["Category(FA)"],
        "Category(PO)": df_combo_current["Category(PO)"],
        "Contract Year": df_combo_current["Contract Year"],
        "Scenario": df_combo_current["Scenario"],
        "Project Definition": df_combo_current["Project Definition"],
        "LE": df_combo_current["LE"],
        "BD": df_combo_current["Customer Unit"],
        "Province": df_combo_current["Province"].map(
            lambda v: v.split("-", 1)[1].strip() if "-" in v else v.strip()
        ),
        "PSP": df_combo_current["PSP"],
        "CPM": df_combo_current["CPM"],
        "CPM Delegation": df_combo_current["CPM Delegation"],
        "CPM LM Signum": df_combo_current["CPM LM Signum"],
        "Site": df_combo_current["Site"],
        "Category": df_combo_current["Category"],
        "CV (Combo)": lambda x: _to_numeric_fillna(df_combo_current["Cont Value"]),  # type: ignore[arg-type]
        "CV (OEF)": lambda x: _to_numeric_fillna(df_combo_current["OEF Value"]),  # type: ignore[arg-type]
        "PD Creation Date": pd_creation_date_series,
        "ES Approved Date": es_approved_date_series,
        "Signed Date": signed_date_series,
        "First Delivery Date": first_delivery_series,
        "Last OA Date": last_oa_date_series,
        "Last POD Date": last_pod_date_series,
        "DEL Date Previous": lambda x, series=dac_previous_series: x["Contract No"].map(series),
        "DEL Date Current": del_date_current_series,
        "DEL Date Actual": del_date_actual_series,
        "DEL Value-Combo": lambda x: _to_numeric_fillna(df_combo_current["Dac Value"]),  # type: ignore[arg-type]
        "Pac Baseline": pac_baseline_series,
        "PAC or Cutover": df_combo_current["PAC or Cutover"],
        "PAC Date Previous": lambda x, series=pac_previous_series: x["Contract No"].map(series),
        "PAC Date Current": pac_date_current_series,
        "PAC Date Actual": pac_date_actual_series,
        "PAC Value-Combo": lambda x: _to_numeric_fillna(df_combo_current["Pac Value"]),  # type: ignore[arg-type]
        "Fac Baseline": fac_baseline_series,
        "FAC Date Previous": lambda x, series=fac_previous_series: x["Contract No"].map(series),
        "FAC Date Current": fac_date_current_series,
        "FAC Date Actual": fac_date_actual_series,
        "FAC Value-Combo": pd.to_numeric(df_combo_current["Fac Value"], errors="coerce").fillna(0),  # type: ignore[attr-defined]
        "Acc. Collection": pd.to_numeric(
            df_combo_current["Acc. Collection"], errors="coerce"
        ).fillna(0),  # type: ignore[attr-defined]
        "Acc. Collection %": pd.to_numeric(
            df_combo_current["Acc. Collection %"], errors="coerce"
        ).fillna(0),  # type: ignore[attr-defined]
        "Have Po": df_combo_current["Have Po"],
        "Updated On": df_combo_current["Updated On"],
        "Early Collection": df_combo_current["Early Collection"],
        "Back Stop": df_combo_current["Back Stop"],
        "Alert Message": df_combo_current["Alert Message"],
        "Reason": df_combo_current["Reason"],
        "CPM Comments": df_combo_current["CPM Comments"],
        "Unbilled": (
            lambda x, series=unbilled_series: pd.to_numeric(
                x["Contract No"].map(series),
                errors="coerce",
            ).fillna(0)  # type: ignore[attr-defined]
        ),
        "Billed": (
            lambda x, series=billed_total_series: pd.to_numeric(
                x["Contract No"].map(series),
                errors="coerce",
            ).fillna(0)  # type: ignore[attr-defined]
        ),
        "Billed not due": (
            lambda x, series=billed_not_due_series: pd.to_numeric(
                x["Contract No"].map(series),
                errors="coerce",
            ).fillna(0)  # type: ignore[attr-defined]
        ),
        "Billed overdue": (
            lambda x, series=billed_overdue_series: pd.to_numeric(
                x["Contract No"].map(series),
                errors="coerce",
            ).fillna(0)  # type: ignore[attr-defined]
        ),
        "AR indicator": (
            lambda x: np.where((x["Unbilled"] == 0) & (x["Billed"] == 0), "no AR", "has AR")
        ),
        "Payterm": (
            lambda x, series=payment_term_series: x["Contract No"].map(series).fillna(0)  # type: ignore[attr-defined]
        ),
        "DAC term": lambda x: pd.to_numeric(
            _extract_payterm_col(x["Payterm"], 0), errors="coerce"
        ).fillna(0),  # type: ignore[attr-defined]
        "PAC term": lambda x: pd.to_numeric(
            _extract_payterm_col(x["Payterm"], 1), errors="coerce"
        ).fillna(0),  # type: ignore[attr-defined]
        "FAC term": lambda x: pd.to_numeric(
            _extract_payterm_col(x["Payterm"], 2), errors="coerce"
        ).fillna(0),  # type: ignore[attr-defined]
        "ACT term": lambda x: pd.to_numeric(
            _extract_payterm_col(x["Payterm"], 3), errors="coerce"
        ).fillna(0),  # type: ignore[attr-defined]
        "Acc Collection": (
            lambda x, series=acc_collection_series: pd.to_numeric(
                x["Contract No"].map(series),
                errors="coerce",
            ).fillna(0)  # type: ignore[attr-defined]
        ),
    }

    amt_assignments: dict[str, Any] = {
        "Amt to add-Total": (
            lambda x, manual_balance_map=manual_balance_map: _apply_manual_amt_to_add(
                cast(pd.Series, x["Contract No"]),
                cast(pd.Series, x["CV (OEF)"] - x["Acc Collection"]),
                manual_balance_map,
            )
        ),
        "DEL amt to add": (
            lambda x: np.where(
                x["Amt to add-Total"]
                <= (x["PAC term"] + x["FAC term"] + x["ACT term"]) * x["CV (OEF)"] / 100,
                0,
                x["Amt to add-Total"]
                - x["CV (OEF)"] * (x["PAC term"] + x["FAC term"] + x["ACT term"]) / 100,
            )
        ),
        "PAC amt to add": (
            lambda x: np.select(
                [
                    (
                        x["Amt to add-Total"]
                        > (x["CV (OEF)"] * (x["FAC term"] + x["ACT term"]) / 100)
                    )
                    & (
                        x["Amt to add-Total"]
                        <= x["CV (OEF)"] * (x["PAC term"] + x["FAC term"] + x["ACT term"]) / 100
                    ),
                    (
                        x["Amt to add-Total"]
                        > x["CV (OEF)"] * (x["PAC term"] + x["FAC term"] + x["ACT term"]) / 100
                    ),
                ],
                [
                    x["Amt to add-Total"] - x["CV (OEF)"] * (x["FAC term"] + x["ACT term"]) / 100,
                    x["CV (OEF)"] * x["PAC term"] / 100,
                ],
                default=0,
            )
        ),
        "FAC amt to add": (
            lambda x: np.where(
                x["Amt to add-Total"] < x["CV (OEF)"] * (x["FAC term"] + x["ACT term"]) / 100,
                x["Amt to add-Total"],
                x["CV (OEF)"] * (x["FAC term"] + x["ACT term"]) / 100,
            )
        ),
    }

    indicator_assignments: dict[str, Any] = {
        "DAC indicator": (
            lambda x: np.where(x["DEL Date Actual"].isna() | (x["DEL Date Actual"] == ""), "P", "A")
        ),
        "PAC indicator": (
            lambda x: np.where(x["PAC Date Actual"].isna() | (x["PAC Date Actual"] == ""), "P", "A")
        ),
        "FAC indicator": (
            lambda x: np.where(x["FAC Date Actual"].isna() | (x["FAC Date Actual"] == ""), "P", "A")
        ),
    }

    lead_time_assignments: dict[str, Any] = {
        "DAC Lead time": (
            lambda x: np.where(
                x["First Delivery Date"].isna(),
                np.nan,
                np.where(
                    x["DAC indicator"] == "A",
                    (x["DEL Date Actual"] - x["First Delivery Date"]).dt.days,
                    np.where(
                        x["DEL Date Current"].isna(),
                        np.nan,
                        (x["DEL Date Current"] - x["First Delivery Date"]).dt.days,
                    ),
                ),
            )
        ),
        "PAC Lead time": (
            lambda x: np.where(
                (x["DAC indicator"] == "P") & (x["PAC indicator"] == "A"),
                np.nan,
                np.where(
                    (x["DAC indicator"] == "A") & (x["PAC indicator"] == "A"),
                    (x["PAC Date Actual"] - x["DEL Date Actual"]).dt.days,
                    np.where(
                        x["PAC Date Current"].isna(),
                        np.nan,
                        np.where(
                            x["DAC indicator"] == "A",
                            (x["PAC Date Current"] - x["DEL Date Actual"]).dt.days,
                            np.where(
                                x["DEL Date Current"].isna(),
                                np.nan,
                                (x["PAC Date Current"] - x["DEL Date Current"]).dt.days,
                            ),
                        ),
                    ),
                ),
            )
        ),
        "FAC Lead time": (
            lambda x: np.where(
                (x["PAC indicator"] == "P") & (x["FAC indicator"] == "A"),
                np.nan,
                np.where(
                    (x["FAC indicator"] == "A") & (x["PAC indicator"] == "A"),
                    (x["FAC Date Actual"] - x["PAC Date Actual"]).dt.days,
                    np.where(
                        x["FAC Date Current"].isna(),
                        np.nan,
                        np.where(
                            x["PAC indicator"] == "A",
                            (x["FAC Date Current"] - x["PAC Date Actual"]).dt.days,
                            np.where(
                                x["PAC Date Current"].isna(),
                                np.nan,
                                (x["FAC Date Current"] - x["PAC Date Current"]).dt.days,
                            ),
                        ),
                    ),
                ),
            )
        ),
    }

    last_month_assignments: dict[str, Any] = {
        "AVG PAC Lead-Time": (
            lambda x: (x.groupby(["Category 1", "BD", "PAC indicator"])["PAC Lead time"]).transform(
                "mean"
            )
        ),
        "AVG FAC Lead-Time": (
            lambda x: (x.groupby(["Category 1", "BD", "FAC indicator"])["FAC Lead time"]).transform(
                "mean"
            )
        ),
        "PAC>185": (
            lambda x: np.where(
                pd.to_numeric(x["PAC Lead time"], errors="coerce").gt(185),  # type: ignore[attr-defined]
                "PAC>185 Days",
                "",
            )
        ),
        "FAC>185": (
            lambda x: np.where(
                pd.to_numeric(x["FAC Lead time"], errors="coerce").gt(185),  # type: ignore[attr-defined]
                "FAC>185 days",
                "",
            )
        ),
        "PAC Days > 185 days as of last month": (
            lambda x: (ref_date - x["DEL Date Actual"].fillna(x["DEL Date Current"])).dt.days
        ),
        "PAC amt. > 185 days as of last month": (
            lambda x: np.where(
                x["PAC Days > 185 days as of last month"] >= 185,
                x["PAC amt to add"],
                0,
            )
        ),
        "FAC Days > 185 days as of last month": (
            lambda x: (ref_date - x["PAC Date Actual"].fillna(x["PAC Date Current"])).dt.days
        ),
        "FAC amt. > 185 days as of last month": (
            lambda x: np.where(
                x["FAC Days > 185 days as of last month"] >= 185,
                x["FAC amt to add"],
                0,
            )
        ),
        "PAC LT last M": (
            lambda x, last_month_indexed=last_month_indexed: _map_last_month_numeric(
                x, last_month_indexed, "PAC Lead time"
            )
        ),
        "PAC changes": (
            lambda x: pd.to_numeric(x["PAC LT last M"], errors="coerce")  # type: ignore[operator]
            - pd.to_numeric(x["PAC Lead time"], errors="coerce")
        ),
        "FAC LT last M": (
            lambda x, last_month_indexed=last_month_indexed: _map_last_month_numeric(
                x, last_month_indexed, "FAC Lead time"
            )
        ),
        "FAC Change": (
            lambda x: pd.to_numeric(x["FAC LT last M"], errors="coerce")  # type: ignore[operator]
            - pd.to_numeric(x["FAC Lead time"], errors="coerce")
        ),
    }

    filter_assignments: dict[str, Any] = {
        "5GC or not": (
            lambda x: np.where(x["Category 1"].str.contains("5GC", na=False), "5GC", "non-5GC")
        ),
        "If amt to add has value": (
            lambda x: np.where(x["Amt to add-Total"] > 10, "Yes", None)  # type: ignore[arg-type]
        ),
        "If DEL has value": (
            lambda x: np.where(x["DEL amt to add"] > 10, "Yes", None)  # type: ignore[arg-type]
        ),
        "If PAC has value": (
            lambda x: np.where(x["PAC amt to add"] > 10, "Yes", None)  # type: ignore[arg-type]
        ),
        "If FAC has value": (
            lambda x: np.where(x["FAC amt to add"] > 10, "Yes", None)  # type: ignore[arg-type]
        ),
        "PAC Delay filter": (
            lambda x: np.where(
                (x["PAC Date Actual"].isna())
                & ((x["PAC Date Current"] - x["PAC Date Previous"]).dt.days > 0)
                & ((x["PAC Date Current"] - x["PAC Date Previous"]).dt.days < 45000),
                "Yes",
                None,  # type: ignore[arg-type]
            )
        ),
        "FAC Delay filter": (
            lambda x: np.where(
                (x["FAC Date Actual"].isna())
                & ((x["FAC Date Current"] - x["FAC Date Previous"]).dt.days > 0)
                & ((x["FAC Date Current"] - x["FAC Date Previous"]).dt.days < 45000),
                "Yes",
                None,  # type: ignore[arg-type]
            )
        ),
        "PAC/FAC delay filter": (
            lambda x: np.where(
                (x["PAC Delay filter"] == "Yes") | (x["FAC Delay filter"] == "Yes"),
                "Yes",
                None,  # type: ignore[arg-type]
            )
        ),
        "PO closed": (
            lambda x, manual_status_map=manual_status_map: _apply_manual_status(
                cast(pd.Series, x["Contract No"]), manual_status_map
            )
        ),
        LONG_AGE_COLUMN: (
            lambda x, manual_long_age_map=manual_long_age_map: _apply_manual_long_age(
                cast(pd.Series, x["Contract No"]), manual_long_age_map
            )
        ),
    }

    balance_target_assignments: dict[str, Any] = {}
    balance_target_assignments.update(
        update_monthly_balance(df_raw_data_last_month, runtime_ctx=runtime_ctx)
    )
    balance_target_assignments.update(update_cash_landing())
    balance_target_assignments.update(
        {
            "Q1 landing": (
                lambda x: x[[f"{i:02d}A Cash Landing(PFT)" for i in range(1, 4)]].sum(axis=1)
            ),
            "Q2 landing": (
                lambda x: x[[f"{i:02d}A Cash Landing(PFT)" for i in range(4, 7)]].sum(axis=1)
            ),
            "Q3 landing": (
                lambda x: x[[f"{i:02d}A Cash Landing(PFT)" for i in range(7, 10)]].sum(axis=1)
            ),
            "Q4 landing": (
                lambda x: x[[f"{i:02d}A Cash Landing(PFT)" for i in range(10, 13)]].sum(axis=1)
            ),
            "Q1 Target": _build_target_lambda(
                1, current_quarter, target_mapping, last_month_target_maps
            ),
            "Q1 Target balance": _build_target_balance_lambda(
                1, current_quarter, target_mapping, last_month_balance_maps
            ),
            "Q2 Target": _build_target_lambda(
                2, current_quarter, target_mapping, last_month_target_maps
            ),
            "Q2 Target balance": _build_target_balance_lambda(
                2, current_quarter, target_mapping, last_month_balance_maps
            ),
            "Q3 Target": _build_target_lambda(
                3, current_quarter, target_mapping, last_month_target_maps
            ),
            "Q3 Target balance": _build_target_balance_lambda(
                3, current_quarter, target_mapping, last_month_balance_maps
            ),
            "Q4 Target": _build_target_lambda(
                4, current_quarter, target_mapping, last_month_target_maps
            ),
            "Q4 Target balance": _build_target_balance_lambda(
                4, current_quarter, target_mapping, last_month_balance_maps
            ),
        }
    )

    compliance_assignments: dict[str, Any] = {
        "Filter for COM": (
            lambda x: np.where(
                (
                    (
                        (x["PAC>185"] == "PAC>185 Days")
                        & (x["Amt to add-Total"] > 10)
                        & (x["PAC indicator"] == "P")
                    )
                    | (
                        (x["FAC>185"] == "FAC>185 days")
                        & (x["Amt to add-Total"] > 10)
                        & (x["FAC indicator"] == "P")
                    )
                    | (x[LONG_AGE_COLUMN] == LONG_AGE_FLAG_VALUE)
                ),
                "COM to action",
                None,  # type: ignore[arg-type]
            )
        ),
        "Lead time threshhold": LEAD_TIME_THRESHHOLD,
        "DEL change icon": (
            lambda x: np.where(
                (
                    ((x["DEL Date Actual"] - x["DEL Date Current"]).dt.days < 0)
                    & ((x["DEL Date Actual"] - x["DEL Date Current"]).dt.days > -40000)
                    & (x["Amt to add-Total"] > 10)
                    & (x["DAC indicator"] == "A")
                    & (x["FAC indicator"] == "P")
                ),
                "DEL Advance",
                None,  # type: ignore[arg-type]
            )
        ),
        "PAC change icon": (
            lambda x: np.where(
                (
                    ((x["PAC Date Current"] - x["PAC Date Previous"]).dt.days > 0)
                    & ((x["PAC Date Current"] - x["PAC Date Previous"]).dt.days < 40000)
                    & (x["Amt to add-Total"] > 10)
                    & (x["PAC indicator"] == "P")
                ),
                "PAC delay",
                None,  # type: ignore[arg-type]
            )
        ),
        "FAC change icon": (
            lambda x: np.where(
                (
                    ((x["FAC Date Current"] - x["FAC Date Previous"]).dt.days > 0)
                    & ((x["FAC Date Current"] - x["FAC Date Previous"]).dt.days < 40000)
                    & (x["FAC indicator"] == "P")
                    & (x["Amt to add-Total"] > 10)
                ),
                "FAC delay",
                None,  # type: ignore[arg-type]
            )
        ),
    }

    cpm_assignments: dict[str, Any] = {
        "PAC>185 for CPM": (
            lambda x: np.where(
                (
                    (x["PAC>185"] == "PAC>185 Days")
                    & (x["PAC indicator"] == "P")
                    & (x["Category 2"] != "Others")
                    & (x["AR indicator"] == "has AR")
                    & (x["If PAC has value"] == "Yes")
                ),
                "PAC>185 Days",
                None,  # type: ignore[arg-type]
            )
        ),
        "FAC>185 for CPM": (
            lambda x: np.where(
                (
                    (x["FAC>185"] == "FAC>185 days")
                    & (x["Category 2"] != "Others")
                    & (x["Amt to add-Total"] > 10)
                    & (x["FAC indicator"] == "P")
                    & (x["If FAC has value"] == "Yes")
                ),
                "FAC>185 Days",
                None,  # type: ignore[arg-type]
            )
        ),
        "PAC>185 amt.(LT)": (
            lambda x: np.where(
                x["PAC>185 for CPM"] == "PAC>185 Days",
                x["PAC amt to add"],
                0,
            )
        ),
        "FAC>185 amt.(LT)": (
            lambda x: np.where(
                x["FAC>185 for CPM"] == "FAC>185 Days",
                x["FAC amt to add"],
                0,
            )
        ),
    }

    pac_fac_split_assignments: dict[str, Any] = {
        "PAC by Year": (lambda x: x["PAC Date Current"].dt.year),
        "PAC by Q": (lambda x: x["PAC Date Current"].dt.quarter),
        "PAC in Q1": (
            lambda x: np.where(
                (x["PAC>185 for CPM"] == "PAC>185 Days")
                & (x["PAC by Year"] == current_year)
                & (x["PAC by Q"] == 1),
                x["PAC>185 amt.(LT)"],
                0,
            )
        ),
        "PAC in Q2": (
            lambda x: np.where(
                (x["PAC>185 for CPM"] == "PAC>185 Days")
                & (x["PAC by Year"] == current_year)
                & (x["PAC by Q"] == 2),
                x["PAC>185 amt.(LT)"],
                0,
            )
        ),
        "PAC in Q3": (
            lambda x: np.where(
                (x["PAC>185 for CPM"] == "PAC>185 Days")
                & (x["PAC by Year"] == current_year)
                & (x["PAC by Q"] == 3),
                x["PAC>185 amt.(LT)"],
                0,
            )
        ),
        "PAC in Q4": (
            lambda x: np.where(
                (x["PAC>185 for CPM"] == "PAC>185 Days")
                & (x["PAC by Year"] == current_year)
                & (x["PAC by Q"] == 4),
                x["PAC>185 amt.(LT)"],
                0,
            )
        ),
        "PAC after Q4": (
            lambda x: np.where(
                (x["PAC>185 for CPM"] == "PAC>185 Days") & (x["PAC by Year"] == current_year + 1),
                x["PAC>185 amt.(LT)"],
                0,
            )
        ),
        "PAC other": (
            lambda x: x["PAC>185 amt.(LT)"]
            - x.get("PAC in Q2", 0)
            - x.get("PAC in Q3", 0)
            - x.get("PAC in Q4", 0)
            - x.get("PAC after Q4", 0)
        ),
        "FAC by Year": (lambda x: x["FAC Date Current"].dt.year),
        "FAC by Q": (lambda x: x["FAC Date Current"].dt.quarter),
        "FAC in Q1": (
            lambda x: np.where(
                (x["FAC>185 for CPM"] == "FAC>185 Days")
                & (x["FAC by Year"] == current_year)
                & (x["FAC by Q"] == 1),
                x["FAC>185 amt.(LT)"],
                0,
            )
        ),
        "FAC in Q2": (
            lambda x: np.where(
                (x["FAC>185 for CPM"] == "FAC>185 Days")
                & (x["FAC by Year"] == current_year)
                & (x["FAC by Q"] == 2),
                x["FAC>185 amt.(LT)"],
                0,
            )
        ),
        "FAC in Q3": (
            lambda x: np.where(
                (x["FAC>185 for CPM"] == "FAC>185 Days")
                & (x["FAC by Year"] == current_year)
                & (x["FAC by Q"] == 3),
                x["FAC>185 amt.(LT)"],
                0,
            )
        ),
        "FAC in Q4": (
            lambda x: np.where(
                (x["FAC>185 for CPM"] == "FAC>185 Days")
                & (x["FAC by Year"] == current_year)
                & (x["FAC by Q"] == 4),
                x["FAC>185 amt.(LT)"],
                0,
            )
        ),
        "FAC after Q4": (
            lambda x: np.where(
                (x["FAC>185 for CPM"] == "FAC>185 Days") & (x["FAC by Year"] == current_year + 1),
                x["FAC>185 amt.(LT)"],
                0,
            )
        ),
        "FAC other": (
            lambda x: x["FAC>185 amt.(LT)"]
            - x.get("FAC in Q2", 0)
            - x.get("FAC in Q3", 0)
            - x.get("FAC in Q4", 0)
            - x.get("FAC after Q4", 0)
        ),
        "PAC/FAC in Q1": (lambda x: x.get("PAC in Q1", 0) + x.get("FAC in Q1", 0)),
        "PAC/FAC in Q2": (lambda x: x.get("PAC in Q2", 0) + x.get("FAC in Q2", 0)),
        "PAC/FAC in Q3": (lambda x: x.get("PAC in Q3", 0) + x.get("FAC in Q3", 0)),
        "PAC/FAC in Q4": (lambda x: x.get("PAC in Q4", 0) + x.get("FAC in Q4", 0)),
        "PAC/FAC after Q4": (lambda x: x.get("PAC after Q4", 0) + x.get("FAC after Q4", 0)),
        "PAC/FAC other": (lambda x: x.get("PAC other", 0) + x.get("FAC other", 0)),
        "PAC+FAC amount >185": (lambda x: x["PAC>185 amt.(LT)"] + x["FAC>185 amt.(LT)"]),
    }

    billing_assignments: dict[str, Any] = {
        "Billed Del": (
            lambda x, series=billed_del_series: pd.to_numeric(
                x["Contract No"].map(series),
                errors="coerce",
            ).fillna(0)  # type: ignore[attr-defined]
        ),
        "Billed PAC": (
            lambda x, series=billed_pac_series: pd.to_numeric(
                x["Contract No"].map(series),
                errors="coerce",
            ).fillna(0)  # type: ignore[attr-defined]
        ),
        "Billed FAC": (
            lambda x, series=billed_fac_series: pd.to_numeric(
                x["Contract No"].map(series),
                errors="coerce",
            ).fillna(0)  # type: ignore[attr-defined]
        ),
        "Billed ACT": (
            lambda x, series=billed_act_series: pd.to_numeric(
                x["Contract No"].map(series),
                errors="coerce",
            ).fillna(0)  # type: ignore[attr-defined]
        ),
        "Billed Total": (
            lambda x, series=billed_total_series: pd.to_numeric(
                x["Contract No"].map(series),
                errors="coerce",
            ).fillna(0)  # type: ignore[attr-defined]
        ),
        "Total AR": (
            lambda x, series=total_ar_series: pd.to_numeric(
                x["Contract No"].map(series),
                errors="coerce",
            ).fillna(0)  # type: ignore[attr-defined]
        ),
    }

    lead_time_bucket_assignments: dict[str, Any] = {
        "PAC lead time node": (
            lambda x: np.where(
                pd.to_numeric(x["PAC Lead time"], errors="coerce").notna(),  # type: ignore[attr-defined]
                np.select(
                    condlist=[
                        x["PAC Lead time"] <= 125,
                        x["PAC Lead time"] <= 155,
                        x["PAC Lead time"] <= 185,
                        x["PAC Lead time"] <= 365,
                        x["PAC Lead time"] > 365,
                    ],
                    choicelist=[
                        "PAC<4 months",
                        "PAC 4~5 months",
                        "PAC 5~6 months",
                        "PAC>6 months",
                        "PAC>12 months",
                    ],
                    default=None,  # type: ignore[arg-type]
                ),
                None,  # type: ignore[arg-type]
            )
        ),
        "FAC lead time node": (
            lambda x: np.where(
                pd.to_numeric(x["FAC Lead time"], errors="coerce").notna(),  # type: ignore[attr-defined]
                np.select(
                    condlist=[
                        x["FAC Lead time"] <= 125,
                        x["FAC Lead time"] <= 155,
                        x["FAC Lead time"] <= 185,
                        x["FAC Lead time"] <= 365,
                        x["FAC Lead time"] > 365,
                    ],
                    choicelist=[
                        "FAC<4 months",
                        "FAC 4~5 months",
                        "FAC 5~6 months",
                        "FAC>6 months",
                        "FAC>12 months",
                    ],
                    default=None,  # type: ignore[arg-type]
                ),
                None,  # type: ignore[arg-type]
            )
        ),
        "DAC leadtime (D3-D2)": (
            lambda x: np.where(
                x["DAC indicator"] == "A",
                (x["DEL Date Actual"] - x["Last POD Date"]).dt.days,
                (x["DEL Date Current"] - x["Last POD Date"]).dt.days,
            )
        ),
        "DAC leadtime (D2-D1)": (lambda x: (x["Last POD Date"] - x["Signed Date"]).dt.days),
    }

    assignments_sequence = [
        base_assignments,
        amt_assignments,
        indicator_assignments,
        lead_time_assignments,
        last_month_assignments,
        filter_assignments,
        balance_target_assignments,
        compliance_assignments,
        cpm_assignments,
        pac_fac_split_assignments,
        billing_assignments,
        lead_time_bucket_assignments,
    ]

    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=pd.errors.PerformanceWarning)
        df_result = _apply_assignments(pd.DataFrame(), assignments_sequence)

    df_result = df_result.copy()

    float_cols = df_result.select_dtypes(
        include=["float32", "float64", "Float32", "Float64"]
    ).columns
    if len(float_cols) > 0:
        df_result[float_cols] = df_result[float_cols].round(FIRST_FORMULA_ROUND_DECIMALS)

    amt_cols = [
        "Acc Collection",
        "Amt to add-Total",
        "DEL amt to add",
        "PAC amt to add",
        "FAC amt to add",
    ]

    df_result[amt_cols] = df_result[amt_cols].mask(df_result["Amt to add-Total"] < -10)

    return df_result


def update_monthly_balance(
    df_raw_data_last_month, runtime_ctx: RuntimeContext, contract_col="Contract No"
):
    """
    更新年度 Balance 列：
    1. 时间从上一年12月到今年12月自动生成列名；
    2. 截止到上一个月的数据从 df_raw_data_last_month 根据 Contract No 匹配过来；
    3. 其余列保持为空（np.nan）。

    参数：
    df : pd.DataFrame
        当前年度 DataFrame
    df_raw_data_last_month : pd.DataFrame
        上个月的数据 DataFrame，包含 Contract No 列和 Balance 列
    contract_col : str
        合同编号列名，默认 "Contract No"

    返回：
    pd.DataFrame
        更新后的 df
    """
    current_year = runtime_ctx["current_year"]
    current_month = runtime_ctx["current_month"]
    previous_year = current_year - 1

    month_defs: list[tuple[str, int, int]] = [
        (f"Y{previous_year % 100:02d}{12:02d}A Balance", previous_year, 12)
    ] + [
        (f"Y{current_year % 100:02d}{month:02d}A Balance", current_year, month)
        for month in range(1, 13)
    ]

    assign_dict: dict[str, Callable[[DataFrame], pd.Series]] = {}

    last_month_indexed: DataFrame | None = None
    if contract_col in df_raw_data_last_month.columns:
        last_month_indexed = df_raw_data_last_month.set_index(contract_col)

    def _map_last_month(col_name: str) -> Callable[[DataFrame], pd.Series]:
        if last_month_indexed is None or col_name not in last_month_indexed.columns:
            return lambda x: pd.Series(np.nan, index=x.index)
        mapping_dict = cast(pd.Series, last_month_indexed[col_name]).to_dict()
        return lambda x, m=mapping_dict: cast(
            pd.Series, x[contract_col].apply(lambda v, mp=m: mp.get(v, np.nan))
        )

    for col_name, year, month in month_defs:
        if (year < current_year) or (year == current_year and month < current_month):
            assign_dict[col_name] = _map_last_month(col_name)
        elif year == current_year and month == current_month:
            assign_dict[col_name] = lambda x: cast(pd.Series, x["Amt to add-Total"])
        else:
            assign_dict[col_name] = lambda x: pd.Series(np.nan, index=x.index)

    return assign_dict


def update_cash_landing():
    """
    初始化 01A~12A Cash Landing(PFT) 列，值全部设为 0。

    参数：
    df : pd.DataFrame
        目标 DataFrame

    返回：
    pd.DataFrame
        更新后的 DataFrame
    """
    # 动态生成列名 01A~12A
    cash_cols = [f"{i:02d}A Cash Landing(PFT)" for i in range(1, 13)]
    return dict.fromkeys(cash_cols, 0)


def update_quarter_target(
    df_raw_data_last_month: DataFrame,
    df_target: DataFrame,
    current_quarter: int,
    contract_col: str = "Contract No",
) -> dict[str, Callable[[DataFrame], pd.Series]]:
    target_map: pd.Series | None = None
    if {"Contract No.", "Q4F9RES"}.issubset(df_target.columns):
        target_series = df_target.set_index("Contract No.")["Q4F9RES"].dropna()
        if not target_series.empty:
            target_map = cast(pd.Series, target_series)

    target_dict: dict[str, float] | None = None
    if target_map is not None:
        target_dict = cast(dict[str, float], target_map.to_dict())

    raw_indexed: DataFrame | None = None
    if contract_col in df_raw_data_last_month.columns:
        raw_indexed = df_raw_data_last_month.set_index(contract_col)

    raw_q1_target = (
        cast(pd.Series, raw_indexed["Q1 Target"]).to_dict()
        if raw_indexed is not None and "Q1 Target" in raw_indexed.columns
        else None
    )
    raw_q1_balance = (
        cast(pd.Series, raw_indexed["Q1 Target balance"]).to_dict()
        if raw_indexed is not None and "Q1 Target balance" in raw_indexed.columns
        else None
    )
    raw_q2_target = (
        cast(pd.Series, raw_indexed["Q2 Target"]).to_dict()
        if raw_indexed is not None and "Q2 Target" in raw_indexed.columns
        else None
    )
    raw_q2_balance = (
        cast(pd.Series, raw_indexed["Q2 Target balance"]).to_dict()
        if raw_indexed is not None and "Q2 Target balance" in raw_indexed.columns
        else None
    )
    raw_q3_target = (
        cast(pd.Series, raw_indexed["Q3 Target"]).to_dict()
        if raw_indexed is not None and "Q3 Target" in raw_indexed.columns
        else None
    )
    raw_q3_balance = (
        cast(pd.Series, raw_indexed["Q3 Target balance"]).to_dict()
        if raw_indexed is not None and "Q3 Target balance" in raw_indexed.columns
        else None
    )
    raw_q4_target = (
        cast(pd.Series, raw_indexed["Q4 Target"]).to_dict()
        if raw_indexed is not None and "Q4 Target" in raw_indexed.columns
        else None
    )
    raw_q4_balance = (
        cast(pd.Series, raw_indexed["Q4 Target balance"]).to_dict()
        if raw_indexed is not None and "Q4 Target balance" in raw_indexed.columns
        else None
    )

    def _map_or_nan(df: DataFrame, mapping: dict[Any, Any] | None) -> pd.Series:
        if mapping is None:
            return pd.Series(np.nan, index=df.index, dtype="float64")
        return cast(pd.Series, df[contract_col]).map(mapping)  # type: ignore[arg-type]

    assign_dict: dict[str, Callable[[DataFrame], pd.Series]] = {
        "Q1 Target": cast(
            Callable[[DataFrame], pd.Series],
            lambda df: _map_or_nan(
                df,
                target_dict if current_quarter == 1 and target_dict is not None else raw_q1_target,
            ),
        ),
        "Q1 Target balance": cast(
            Callable[[DataFrame], pd.Series],
            lambda df: _map_or_nan(
                df,
                target_dict if current_quarter == 1 and target_dict is not None else raw_q1_balance,
            ),
        ),
        "Q2 Target": cast(
            Callable[[DataFrame], pd.Series],
            lambda df: _map_or_nan(
                df,
                target_dict if current_quarter == 2 and target_dict is not None else raw_q2_target,
            ),
        ),
        "Q2 Target balance": cast(
            Callable[[DataFrame], pd.Series],
            lambda df: _map_or_nan(
                df,
                target_dict if current_quarter == 2 and target_dict is not None else raw_q2_balance,
            ),
        ),
        "Q3 Target": cast(
            Callable[[DataFrame], pd.Series],
            lambda df: _map_or_nan(
                df,
                target_dict if current_quarter == 3 and target_dict is not None else raw_q3_target,
            ),
        ),
        "Q3 Target balance": cast(
            Callable[[DataFrame], pd.Series],
            lambda df: _map_or_nan(
                df,
                target_dict if current_quarter == 3 and target_dict is not None else raw_q3_balance,
            ),
        ),
        "Q4 Target": cast(
            Callable[[DataFrame], pd.Series],
            lambda df: _map_or_nan(
                df,
                target_dict if current_quarter == 4 and target_dict is not None else raw_q4_target,
            ),
        ),
        "Q4 Target balance": cast(
            Callable[[DataFrame], pd.Series],
            lambda df: _map_or_nan(
                df,
                target_dict if current_quarter == 4 and target_dict is not None else raw_q4_balance,
            ),
        ),
    }

    return assign_dict


def add_quarter_columns_to_long_age(
    df_long_age: DataFrame, df_first_formula: DataFrame, current_quarter: int
) -> DataFrame:
    """
    向 df_long_age 添加季度相关的列。

    参数：
    df_long_age : pd.DataFrame
        要添加列的 DataFrame（从 df_first_formula 的子集创建）
    df_first_formula : pd.DataFrame
        源 DataFrame，包含所有季度相关列

    返回：
    pd.DataFrame
        添加了季度相关列后的 DataFrame

    说明：
    由于 df_long_age 是从 df_first_formula 通过列选择创建的，两者具有相同的索引，
    因此可以直接通过索引对齐添加新列，不会出现错行问题。
    """
    return df_long_age.assign(
        **{
            "Sum of Q1 landing": df_first_formula["Q1 landing"],
            "Sum of Q2 landing": df_first_formula["Q2 landing"],
            "Sum of Q3 landing": df_first_formula["Q3 landing"],
            "Sum of Q4 landing": df_first_formula["Q4 landing"],
            "Current target": df_first_formula[f"Q{current_quarter} Target"],
            "Current Q Target balance": df_first_formula[f"Q{current_quarter} Target balance"],
            "Current Q Landing": df_first_formula[f"Q{current_quarter} landing"],
            "Current month": "Yes",
        }
    )


def build_long_age(df_first_formula: DataFrame, current_quarter: int) -> DataFrame:
    long_age_mask = df_first_formula[LONG_AGE_COLUMN] == LONG_AGE_FLAG_VALUE
    po_closed_series = df_first_formula["PO closed"]
    po_closed_str = po_closed_series.astype("string").str.strip().str.lower()
    po_closed_mask = po_closed_str.notna() & (po_closed_str != "close")

    filtered = df_first_formula.loc[long_age_mask & po_closed_mask]
    df_long_age = cast(DataFrame, filtered.loc[:, get_long_age_cols()]).copy()
    return add_quarter_columns_to_long_age(df_long_age, df_first_formula, current_quarter)


def build_pac_fac_above_185(df_first_formula: DataFrame) -> DataFrame:
    pac_filter = (
        (df_first_formula["PAC>185"] == "PAC>185 Days")
        & (df_first_formula["If PAC has value"] == "Yes")
        & (df_first_formula["AR indicator"] == "has AR")
    )

    fac_filter = (
        (df_first_formula["FAC>185"] == "FAC>185 days")
        & (df_first_formula["If FAC has value"] == "Yes")
        & (df_first_formula["AR indicator"] == "has AR")
    )

    df_pac = df_first_formula.loc[pac_filter, PAC_FAC_ABOVE_185_COLS].copy()
    df_fac = df_first_formula.loc[fac_filter, PAC_FAC_ABOVE_185_COLS].copy()

    if "Payterm" in df_pac.columns:
        df_pac["Payterm"] = "PAC"
    if "Payterm" in df_fac.columns:
        df_fac["Payterm"] = "FAC"

    df_filtered = pd.concat([df_pac, df_fac], ignore_index=True)

    df_filtered["PAC/FAC amt. > 185 days"] = np.where(
        df_filtered["Payterm"] == "PAC",
        df_filtered["PAC amt to add"],
        df_filtered["FAC amt to add"],
    )

    df_filtered["PAC/FAC amt. > 185 days as of last month"] = np.where(
        df_filtered["Payterm"] == "PAC",
        df_filtered["PAC amt. > 185 days as of last month"],
        df_filtered["FAC amt. > 185 days as of last month"],
    )

    df_filtered["Current month filter"] = "Yes"
    df_filtered = df_filtered.loc[:, PAC_FAC_ABOVE_185_FINAL_COLS]

    return df_filtered


def _build_tm_lead_time(
    df_first_formula: DataFrame,
    base_cols: list[str],
    value_col: str,
    node_col: str,
    buckets: list[str],
    output_cols: list[str],
    runtime_ctx: RuntimeContext,
) -> DataFrame:
    valid_mask = df_first_formula[node_col].notna()
    df_tm = df_first_formula.loc[valid_mask, base_cols].copy()

    df_tm["Period"] = runtime_ctx["current_period_tm"]

    df_tm["Current month"] = "Yes"

    node_series = cast(pd.Series, df_tm[node_col]).astype("object")
    value_series = cast(pd.Series, df_tm[value_col])
    for bucket in buckets:
        mask = node_series == bucket
        df_tm[bucket] = value_series.where(mask, other=np.nan)

    return df_tm.loc[:, output_cols]


def build_tm_fac(df_first_formula: DataFrame, runtime_ctx: RuntimeContext) -> DataFrame:
    return _build_tm_lead_time(
        df_first_formula=df_first_formula,
        base_cols=TM_FAC_BASE_COLS,
        value_col="FAC Value-Combo",
        node_col="FAC lead time node",
        buckets=FAC_LEAD_TIME_BUCKETS,
        output_cols=TM_FAC_COLS,
        runtime_ctx=runtime_ctx,
    )


def build_tm_pac(df_first_formula: DataFrame, runtime_ctx: RuntimeContext) -> DataFrame:
    return _build_tm_lead_time(
        df_first_formula=df_first_formula,
        base_cols=TM_PAC_BASE_COLS,
        value_col="PAC Value-Combo",
        node_col="PAC lead time node",
        buckets=PAC_LEAD_TIME_BUCKETS,
        output_cols=TM_PAC_COLS,
        runtime_ctx=runtime_ctx,
    )


def read_excel(input_file: Path, sheet_name: str) -> DataFrame:
    engine = None
    suffix = input_file.suffix.lower()
    if suffix in {".xlsx", ".xlsm", ".xltx", ".xltm"}:
        engine = "openpyxl"

    try:
        df = pd.read_excel(input_file, sheet_name=sheet_name, engine=engine)
    except ImportError as exc:
        if engine == "openpyxl":
            raise ImportError("缺少依赖 openpyxl，请先安装 `openpyxl` 包。") from exc
        raise

    return df


class FileConfig(TypedDict, total=False):
    file_name: str
    sheet_name: str | int
    sheet_names: dict[str, str]
    optional: bool


ConfigDict = dict[str, FileConfig]


def _build_file_config() -> ConfigDict:
    return {
        "combo_current": {
            "file_name": "./files/202510/combo-2510.xlsx",
            "sheet_name": 0,
        },
        "combo_pre": {
            "file_name": "./files/202510/combo-2509.xlsx",
            "sheet_name": 0,
        },
        "acc_collection": {
            "file_name": "./files/202510/collection-2510.xlsx",
            "sheet_name": 0,
        },
        "current_month_collection": {
            "file_name": "./files/202510/pft-2510.xlsx",
            "sheet_name": 0,
        },
        "target": {
            "file_name": "./files/202510/target-2510.xlsx",
            "sheet_name": 0,
        },
        "raw_data_last_month": {
            "file_name": "./files/202510/raw-data-2509.xlsx",
            "sheet_name": 0,
        },
        "manual_adj": {
            "file_name": "./files/manual adj.xlsx",
            "sheet_names": {
                "balance": "balance",
                "status": "status",
                "long_age": "long aged PO#",
            },
            "optional": True,
        },
    }


def _load_required_dataframe(
    key: str,
    cfg: FileConfig,
) -> DataFrame:
    file_name_value = cfg.get("file_name")
    if not file_name_value:
        raise KeyError(f"配置缺少文件路径：{key}")

    file_path = Path(cast(str, file_name_value))
    is_optional = bool(cfg.get("optional", False))

    if not file_path.exists():
        if is_optional:
            raise FileNotFoundError(f"可选文件缺失：{file_path}")
        raise FileNotFoundError(f"输入文件缺失：{file_path}")

    sheet_name_value = cfg.get("sheet_name")
    if sheet_name_value is None:
        raise KeyError(f"配置缺少工作表名称：{key}")

    sheet_name = cast(str, sheet_name_value)
    df = read_excel(input_file=file_path, sheet_name=sheet_name)
    if key == "acc_collection":
        df = _pivot_acc_collection(df)
    return df


def _load_manual_adjustments(
    cfg: FileConfig,
) -> tuple[DataFrame | None, DataFrame | None, DataFrame | None]:
    file_name_value = cfg.get("file_name")
    if not file_name_value:
        raise KeyError("配置缺少文件路径：manual_adj")

    file_path = Path(cast(str, file_name_value))
    is_optional = bool(cfg.get("optional", False))
    if not file_path.exists():
        if is_optional:
            return None, None, None
        raise FileNotFoundError(f"手工调整文件缺失：{file_path}")

    sheet_names = cfg.get("sheet_names", {})
    manual_balance_df, manual_status_df, long_age_df = _load_manual_adj(file_path, sheet_names)
    detected_long_age_column = _detect_long_age_column(long_age_df)
    if detected_long_age_column:
        _set_long_age_column(detected_long_age_column)
    return manual_balance_df, manual_status_df, long_age_df


def _load_dfs_from_config(
    config: ConfigDict,
) -> tuple[
    dict[str, DataFrame],
    DataFrame | None,
    DataFrame | None,
    DataFrame | None,
]:
    dfs: dict[str, DataFrame] = {}
    manual_balance_df: DataFrame | None = None
    manual_status_df: DataFrame | None = None
    long_age_df: DataFrame | None = None

    for key, cfg in config.items():
        if key == "manual_adj":
            manual_balance_df, manual_status_df, long_age_df = _load_manual_adjustments(cfg)
            continue

        dfs[key] = _load_required_dataframe(key, cfg)

    return dfs, manual_balance_df, manual_status_df, long_age_df


def get_dfs() -> tuple[
    DataFrame,
    DataFrame,
    DataFrame,
    DataFrame,
    DataFrame,
    DataFrame,
    pd.Series | None,
    pd.Series | None,
    pd.Series | None,
]:
    """
    主函数：接受输入文件和输出文件路径。
    后续将在此使用 pandas 进行数据处理。
    """
    config = _build_file_config()
    dfs, manual_balance_df, manual_status_df, long_age_df = _load_dfs_from_config(config)

    manual_balance_map, manual_status_map, manual_long_age_map = _prepare_manual_adjustment_maps(
        manual_balance_df, manual_status_df, long_age_df, LONG_AGE_COLUMN
    )

    return (
        dfs["combo_current"],
        dfs["combo_pre"],
        dfs["acc_collection"],
        dfs["current_month_collection"],
        dfs["target"],
        dfs["raw_data_last_month"],
        manual_balance_map,
        manual_status_map,
        manual_long_age_map,
    )


def _pivot_acc_collection(df_acc_collection: DataFrame) -> DataFrame:
    df_pivoted = df_acc_collection.pivot_table(
        index="CCLMID",
        values=["Collection"],
        aggfunc="sum",
    )
    df_pivoted.reset_index(inplace=True)
    return df_pivoted


def maual_update_first_formula(
    df_first_formula: DataFrame,
    manual_balance_map: pd.Series | None = None,
    manual_status_map: pd.Series | None = None,
) -> DataFrame:
    if (manual_balance_map is None or manual_balance_map.empty) and (
        manual_status_map is None or manual_status_map.empty
    ):
        return df_first_formula

    df_adjusted = df_first_formula.copy()

    if manual_balance_map is not None and not manual_balance_map.empty:
        df_adjusted["Amt to add-Total"] = _apply_manual_amt_to_add(
            cast(pd.Series, df_adjusted["Contract No"]),
            cast(pd.Series, df_adjusted["Amt to add-Total"]),
            manual_balance_map,
        )

    if manual_status_map is not None and not manual_status_map.empty:
        df_adjusted["PO closed"] = _apply_manual_status(
            cast(pd.Series, df_adjusted["Contract No"]), manual_status_map
        )

    return df_adjusted


PAC_FAC_ABOVE_185_COLS = [
    "Period",
    "Payterm",
    "BD",
    "Province",
    "Contract Year",
    "Signed Date",
    "First Delivery Date",
    "Contract No",
    "Category 1",
    "Category 2",
    "DEL Date Current",
    "DEL Date Actual",
    "PAC Date Current",
    "PAC Date Actual",
    "FAC Date Current",
    "FAC Date Actual",
    "PAC Lead time",
    "FAC Lead time",
    "DAC indicator",
    "PAC indicator",
    "FAC indicator",
    "Reason",
    "PAC Date Previous",
    "FAC Date Previous",
    "DEL change icon",
    "PAC change icon",
    "FAC change icon",
    "CPM",
    "Amt to add-Total",
    "DEL amt to add",
    "PAC amt to add",
    "FAC amt to add",
    "PAC Days > 185 days as of last month",
    "PAC amt. > 185 days as of last month",
    "FAC Days > 185 days as of last month",
    "FAC amt. > 185 days as of last month",
    # todo: add back later
    # "PAC/FAC amt. > 185 days",
    # "PAC/FAC amt. > 185 days as of last month",
    # "Current month filter",
    "5GC or not",
]

PAC_FAC_ABOVE_185_FINAL_COLS = [
    "Period",
    "Payterm",
    "BD",
    "Province",
    "Contract Year",
    "Signed Date",
    "First Delivery Date",
    "Contract No",
    "Category 1",
    "Category 2",
    "DEL Date Current",
    "DEL Date Actual",
    "PAC Date Current",
    "PAC Date Actual",
    "FAC Date Current",
    "FAC Date Actual",
    "PAC Lead time",
    "FAC Lead time",
    "DAC indicator",
    "PAC indicator",
    "FAC indicator",
    "Reason",
    "PAC Date Previous",
    "FAC Date Previous",
    "DEL change icon",
    "PAC change icon",
    "FAC change icon",
    "CPM",
    "Amt to add-Total",
    "DEL amt to add",
    "PAC amt to add",
    "FAC amt to add",
    "PAC Days > 185 days as of last month",
    "PAC amt. > 185 days as of last month",
    "FAC Days > 185 days as of last month",
    "FAC amt. > 185 days as of last month",
    "PAC/FAC amt. > 185 days",
    "PAC/FAC amt. > 185 days as of last month",
    "Current month filter",
    "5GC or not",
]

PAC_LEAD_TIME_BUCKETS = [
    "PAC<4 months",
    "PAC 4~5 months",
    "PAC 5~6 months",
    "PAC>6 months",
    "PAC>12 months",
]

FAC_LEAD_TIME_BUCKETS = [
    "FAC<4 months",
    "FAC 4~5 months",
    "FAC 5~6 months",
    "FAC>6 months",
    "FAC>12 months",
]

TM_FAC_BASE_COLS = [
    "Period",
    "BD",
    "Province",
    "Category 1",
    "Category 2",
    "Site",
    "Contract No",
    "Contract Name",
    "Contract Year",
    "FAC Date Current",
    "FAC Date Actual",
    "FAC Lead time",
    "FAC indicator",
    "CV (OEF)",
    "FAC Value-Combo",
    "FAC lead time node",
    "5GC or not",
]

TM_FAC_COLS = [
    "Period",
    "BD",
    "Province",
    "Category 1",
    "Category 2",
    "Site",
    "Contract No",
    "Contract Name",
    "Contract Year",
    "FAC Date Current",
    "FAC Date Actual",
    "FAC Lead time",
    "FAC indicator",
    "CV (OEF)",
    "FAC Value-Combo",
    "5GC or not",
    *FAC_LEAD_TIME_BUCKETS,
    "Current month",
]

TM_PAC_BASE_COLS = [
    "Period",
    "BD",
    "Province",
    "Category 1",
    "Category 2",
    "Site",
    "Contract No",
    "Contract Name",
    "Contract Year",
    "DEL Date Actual",
    "PAC Date Current",
    "PAC Date Actual",
    "PAC Lead time",
    "PAC indicator",
    "CV (OEF)",
    "PAC Value-Combo",
    "5GC or not",
    "PAC lead time node",
]

TM_PAC_COLS = [
    "Period",
    "BD",
    "Province",
    "Category 1",
    "Category 2",
    "Site",
    "Contract No",
    "Contract Name",
    "Contract Year",
    "DEL Date Actual",
    "PAC Date Current",
    "PAC Date Actual",
    "PAC Lead time",
    "PAC indicator",
    "CV (OEF)",
    "PAC Value-Combo",
    "5GC or not",
    *PAC_LEAD_TIME_BUCKETS,
    "Current month",
]


def main() -> None:
    target_month: str | None = "202510"
    runtime_ctx = _build_runtime_context(target_month)
    _initialize_long_age_defaults(runtime_ctx)

    (
        df_combo_current,
        df_combo_pre,
        df_acc_collection,
        df_pft,
        df_target,
        df_raw_data_last_month,
        manual_balance_map,
        manual_status_map,
        manual_long_age_map,
    ) = get_dfs()
    # df_acc_collection = _pivot_acc_collection(df_acc_collection)
    df_first_formula = process_first_formula(
        df_combo_current,
        df_combo_pre,
        df_acc_collection,
        df_pft,
        df_target,
        df_raw_data_last_month,
        runtime_ctx=runtime_ctx,
        manual_balance_map=manual_balance_map,
        manual_status_map=manual_status_map,
        manual_long_age_map=manual_long_age_map,
    )

    df_pac_fac_above_185 = build_pac_fac_above_185(df_first_formula)

    df_long_age = build_long_age(df_first_formula, runtime_ctx["current_quarter"])

    df_tm_fac = build_tm_fac(df_first_formula, runtime_ctx)
    df_tm_pac = build_tm_pac(df_first_formula, runtime_ctx)

    current_month_str = runtime_ctx["current_month_str"]

    with pd.ExcelWriter(
        f"Time Mgmt-{current_month_str}A.xlsx",
        engine="openpyxl",
        date_format="YYYY-MM-DD",
        datetime_format="YYYY-MM-DD",
    ) as writer:
        df_pac_fac_above_185.to_excel(writer, sheet_name="PAC FAC above 185 -PBI", index=False)
        df_long_age.to_excel(writer, sheet_name="Long age-pivot", index=False)
        df_tm_fac.to_excel(writer, sheet_name="TM-FAC", index=False)
        df_tm_pac.to_excel(writer, sheet_name="TM-PAC", index=False)
        df_first_formula.to_excel(writer, sheet_name="raw-data", index=False)


if __name__ == "__main__":
    main()
