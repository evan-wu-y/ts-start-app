import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Copy,
  Check,
  Table2,
  X,
  FileText,
  Download,
  Clipboard,
  FileCode,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TablePreview } from '@/components/table-preview'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/_dashboardLayout/table-converter')({
  component: TableConverter,
})

const EXAMPLE_DATA = `姓名	年龄	城市	职业
张三	25	北京	工程师
李四	30	上海	设计师
王五	28	广州	产品经理
赵六	35	深圳	运营专员`

type DelimiterType = 'auto' | 'tab' | 'comma' | 'semicolon' | 'pipe' | 'space'

const DELIMITER_OPTIONS: Array<{
  value: DelimiterType
  label: string
  char: string
}> = [
  { value: 'auto', label: '自动检测', char: '' },
  { value: 'tab', label: '制表符 (Tab)', char: '\t' },
  { value: 'comma', label: '逗号 (,)', char: ',' },
  { value: 'semicolon', label: '分号 (;)', char: ';' },
  { value: 'pipe', label: '竖线 (|)', char: '|' },
  { value: 'space', label: '多个空格', char: ' ' },
]

function TableConverter() {
  const [input, setInput] = useState('')
  const [jsonData, setJsonData] = useState<Record<string, string>[]>([])
  const [jsonOutput, setJsonOutput] = useState('')
  const [markdownOutput, setMarkdownOutput] = useState('')
  const [copiedJson, setCopiedJson] = useState(false)
  const [copiedMarkdown, setCopiedMarkdown] = useState(false)
  const [delimiter, setDelimiter] = useState<DelimiterType>('auto')
  const inputRef = useRef<HTMLDivElement>(null)

  // 自动检测分隔符
  const detectDelimiter = useCallback((text: string): string => {
    if (!text.trim()) return '\t'

    const firstLine = text.split('\n').find((line) => line.trim())
    if (!firstLine) return '\t'

    // 统计各种分隔符的出现次数
    const counts: Record<string, number> = {
      '\t': (firstLine.match(/\t/g) || []).length,
      ',': (firstLine.match(/,/g) || []).length,
      ';': (firstLine.match(/;/g) || []).length,
      '|': (firstLine.match(/\|/g) || []).length,
    }

    // 检查是否有多个空格
    const hasMultipleSpaces = /\s{2,}/.test(firstLine)

    // 找到出现次数最多的分隔符
    const maxCount = Math.max(...Object.values(counts))
    if (maxCount > 0) {
      const detected = Object.entries(counts).find(
        ([, count]) => count === maxCount,
      )?.[0]
      if (detected) return detected
    }

    // 如果有多个空格，使用空格
    if (hasMultipleSpaces) return ' '

    // 默认使用制表符
    return '\t'
  }, [])

  // 解析表格数据
  const parseTable = useCallback(
    (text: string, delimiterType: DelimiterType = delimiter): string[][] => {
      if (!text.trim()) return []

      const lines = text.split('\n').filter((line) => line.trim())
      if (lines.length === 0) return []

      // 确定使用的分隔符
      let actualDelimiter: string | RegExp
      if (delimiterType === 'auto') {
        actualDelimiter = detectDelimiter(text)
      } else {
        const option = DELIMITER_OPTIONS.find(
          (opt) => opt.value === delimiterType,
        )
        actualDelimiter = option?.char || '\t'
      }

      return lines.map((line) => {
        if (actualDelimiter === ' ') {
          // 多个空格分隔
          return line.split(/\s{2,}/).map((cell) => cell.trim())
        } else {
          // 其他分隔符
          return line.split(actualDelimiter).map((cell) => cell.trim())
        }
      })
    },
    [delimiter, detectDelimiter],
  )

  // 转换为 JSON 对象数组
  const convertToJsonData = useCallback(
    (table: string[][]): Record<string, string>[] => {
      if (table.length === 0) return []

      const [headers, ...rows] = table

      // 如果第一行看起来像表头（所有单元格都有值），使用第一行作为键
      const useFirstRowAsHeaders = headers.every((h) => h.length > 0)

      if (useFirstRowAsHeaders && rows.length > 0) {
        return rows.map((row) => {
          const obj: Record<string, string> = {}
          headers.forEach((header, index) => {
            obj[header || `column${index + 1}`] = row[index] || ''
          })
          return obj
        })
      } else {
        // 如果没有表头，转换为对象数组
        const maxColumns = Math.max(...table.map((row) => row.length), 0)
        return table.map((row) => {
          const obj: Record<string, string> = {}
          Array.from({ length: maxColumns }, (_, index) => {
            obj[`column${index + 1}`] = row[index] || ''
          })
          return obj
        })
      }
    },
    [],
  )

  // 转换为 JSON 字符串（用于显示和下载）
  const convertToJsonString = useCallback(
    (jsonData: Record<string, string>[]): string => {
      if (jsonData.length === 0) return ''
      return JSON.stringify(jsonData, null, 2)
    },
    [],
  )

  // 转换为 Markdown
  const convertToMarkdown = useCallback((table: string[][]): string => {
    if (table.length === 0) return ''

    const [firstRow, ...rows] = table

    // 检查第一行是否像表头
    const useFirstRowAsHeaders = firstRow.every((cell) => cell.length > 0)

    let markdown = ''

    if (useFirstRowAsHeaders && rows.length > 0) {
      // 生成表头
      markdown += '| ' + firstRow.join(' | ') + ' |\n'
      // 生成分隔线
      markdown += '| ' + firstRow.map(() => '---').join(' | ') + ' |\n'
      // 生成数据行
      rows.forEach((row) => {
        markdown += '| ' + row.map((cell) => cell || '').join(' | ') + ' |\n'
      })
    } else {
      // 没有表头，直接生成表格
      table.forEach((row) => {
        markdown += '| ' + row.map((cell) => cell || '').join(' | ') + ' |\n'
      })
    }

    return markdown.trim()
  }, [])

  // 处理输入变化
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
      const table = parseTable(value, delimiter)
      const data = convertToJsonData(table)
      setJsonData(data)
      setJsonOutput(convertToJsonString(data))
      setMarkdownOutput(convertToMarkdown(table))
    },
    [
      parseTable,
      convertToJsonData,
      convertToJsonString,
      convertToMarkdown,
      delimiter,
    ],
  )

  // 处理可编辑容器的输入
  const handleInputPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      range.deleteContents()
      const textNode = document.createTextNode(text)
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)

      // 获取更新后的内容
      const target = e.currentTarget
      const newValue = target.innerText || target.textContent || ''
      handleInputChange(newValue)
    },
    [handleInputChange],
  )

  // 处理可编辑容器的输入事件
  const handleInputInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      const target = e.currentTarget
      const newValue = target.innerText || target.textContent || ''
      handleInputChange(newValue)
    },
    [handleInputChange],
  )

  // 同步 input 状态到 contentEditable（仅在外部更新时，避免与用户输入冲突）
  useEffect(() => {
    if (inputRef.current) {
      const currentText = inputRef.current.innerText || ''
      if (
        currentText !== input &&
        document.activeElement !== inputRef.current
      ) {
        inputRef.current.innerText = input
      }
    }
  }, [input])

  // 处理分隔符变化
  const handleDelimiterChange = useCallback(
    (value: DelimiterType) => {
      setDelimiter(value)
      if (input) {
        const table = parseTable(input, value)
        const data = convertToJsonData(table)
        setJsonData(data)
        setJsonOutput(convertToJsonString(data))
        setMarkdownOutput(convertToMarkdown(table))
      }
    },
    [
      input,
      parseTable,
      convertToJsonData,
      convertToJsonString,
      convertToMarkdown,
    ],
  )

  // 获取表格统计信息
  const tableStats = useMemo(() => {
    const table = parseTable(input, delimiter)
    if (table.length === 0) return null
    return {
      rows: table.length - 1, // 减去表头
      columns: table[0]?.length || 0,
      hasHeaders: table.length > 0 && table[0].every((cell) => cell.length > 0),
    }
  }, [input, delimiter, parseTable])

  // 获取当前使用的分隔符（用于显示）
  const currentDelimiter = useMemo(() => {
    if (delimiter === 'auto' && input) {
      const detected = detectDelimiter(input)
      const option = DELIMITER_OPTIONS.find((opt) => opt.char === detected)
      return option?.label || '自动检测'
    }
    return (
      DELIMITER_OPTIONS.find((opt) => opt.value === delimiter)?.label ||
      '自动检测'
    )
  }, [delimiter, input, detectDelimiter])

  // 加载示例数据
  const handleLoadExample = useCallback(() => {
    setInput(EXAMPLE_DATA)
    handleInputChange(EXAMPLE_DATA)
  }, [handleInputChange])

  // 清空输入
  const handleClear = useCallback(() => {
    setInput('')
    setJsonOutput('')
    setMarkdownOutput('')
  }, [])

  // 复制 JSON 到剪贴板
  const handleCopyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonOutput)
      setCopiedJson(true)
      toast.success('JSON 已复制到剪贴板')
      setTimeout(() => setCopiedJson(false), 2000)
    } catch (error) {
      toast.error('复制失败')
    }
  }, [jsonOutput])

  // 复制 Markdown 到剪贴板
  const handleCopyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdownOutput)
      setCopiedMarkdown(true)
      toast.success('Markdown 已复制到剪贴板')
      setTimeout(() => setCopiedMarkdown(false), 2000)
    } catch (error) {
      toast.error('复制失败')
    }
  }, [markdownOutput])

  // 下载 JSON 文件
  const handleDownloadJson = useCallback(() => {
    if (!jsonOutput) {
      toast.error('没有可下载的内容')
      return
    }
    try {
      const blob = new Blob([jsonOutput], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `table-data-${new Date().getTime()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('JSON 文件已下载')
    } catch (error) {
      toast.error('下载失败')
    }
  }, [jsonOutput])

  // 下载 Markdown 文件
  const handleDownloadMarkdown = useCallback(() => {
    if (!markdownOutput) {
      toast.error('没有可下载的内容')
      return
    }
    try {
      const blob = new Blob([markdownOutput], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `table-data-${new Date().getTime()}.md`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('Markdown 文件已下载')
    } catch (error) {
      toast.error('下载失败')
    }
  }, [markdownOutput])

  const table = parseTable(input, delimiter)

  return (
    <div className="flex flex-1 flex-col p-2 sm:p-4 mx-auto w-full overflow-x-hidden">
      {/* 页面标题 - 紧凑堆叠 */}
      <div className="flex flex-col gap-2 min-w-0 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 flex-1 min-w-0">
            <Table2 className="h-6 w-6 shrink-0" />
            <span className="wrap-break-word">表格数据转换</span>
          </h1>
          {tableStats && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Badge variant="secondary" className="whitespace-nowrap text-xs">
                {tableStats.rows} 行 × {tableStats.columns} 列
              </Badge>
              {tableStats.hasHeaders && (
                <Badge variant="outline" className="whitespace-nowrap text-xs">
                  含表头
                </Badge>
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground wrap-break-word">
          从 Excel 粘贴表格数据，实时转换为 JSON 或 Markdown 格式
        </p>
      </div>

      {/* 堆叠卡片容器 */}
      <div className="flex flex-col gap-3 w-full">
        {/* 输入区域 - 紧凑设计 */}
        <Card className="min-w-0 border-b-0 rounded-b-none">
          <CardHeader className="pb-3 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base flex items-center gap-2 text-foreground">
                  <Clipboard className="h-4 w-4 shrink-0 text-primary" />
                  输入数据
                </CardTitle>
                <CardDescription className="text-xs mt-1.5 text-muted-foreground">
                  从 Excel 或 CSV 复制表格数据并粘贴到这里
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadExample}
                  className="gap-1.5 h-8 text-xs"
                >
                  <FileText className="h-3.5 w-3.5" />
                  示例
                </Button>
                {input && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <X className="h-3.5 w-3.5" />
                    清空
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 min-w-0 overflow-hidden w-full max-w-full">
            <div className="space-y-2 min-w-0 w-full max-w-full">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0 w-full max-w-full">
                <Label htmlFor="input" className="text-sm font-medium shrink-0">
                  表格数据
                </Label>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {input && (
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {input.split('\n').filter((l) => l.trim()).length} 行
                    </p>
                  )}
                  <Label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    分隔符：
                  </Label>
                  <Select
                    value={delimiter}
                    onValueChange={handleDelimiterChange}
                  >
                    <SelectTrigger className="w-full sm:w-[160px] h-8 shrink-0 text-xs">
                      <SelectValue placeholder="选择分隔符" />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIMITER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="w-full min-w-0 max-w-full border border-input rounded-md shadow-xs focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-2 transition-[color,box-shadow] overflow-hidden">
                <ScrollArea className="h-[250px]">
                  <div
                    ref={inputRef}
                    contentEditable
                    suppressContentEditableWarning
                    onPaste={handleInputPaste}
                    onInput={handleInputInput}
                    className="min-h-[250px] font-mono text-xs px-3 py-2 outline-none break-all wrap-break-word whitespace-pre-wrap min-w-0 w-full max-w-full box-border block"
                    data-placeholder="从 Excel 或 CSV 复制数据并粘贴到这里...&#10;&#10;示例格式（制表符）：&#10;姓名	年龄	城市&#10;张三	25	北京&#10;李四	30	上海&#10;&#10;示例格式（逗号）：&#10;姓名,年龄,城市&#10;张三,25,北京&#10;李四,30,上海"
                  />
                </ScrollArea>
              </div>
              <style>{`
                  [contenteditable][data-placeholder]:empty:before {
                    content: attr(data-placeholder);
                    color: hsl(var(--muted-foreground));
                    pointer-events: none;
                  }
                `}</style>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="whitespace-nowrap">
                  💡 支持多种分隔符：Tab、逗号、分号、竖线、多个空格
                </span>
                {delimiter === 'auto' && input && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="whitespace-nowrap">
                      当前检测：{currentDelimiter}
                    </span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 输出区域 - 堆叠在输入区域下方 */}
        <Card className="min-w-0 border-t-0 rounded-t-none">
          <CardHeader className="pb-3 min-w-0">
            <CardTitle className="text-base flex items-center gap-2 text-foreground">
              <FileCode className="h-4 w-4 shrink-0 text-primary" />
              输出结果
            </CardTitle>
            <CardDescription className="text-xs mt-1.5 text-muted-foreground">
              选择输出格式并复制结果
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 min-w-0 overflow-hidden w-full max-w-full">
            <Tabs defaultValue="json" className="w-full min-w-0 max-w-full">
              <TabsList className="grid w-full grid-cols-2 h-9">
                <TabsTrigger value="json" className="gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  JSON
                </TabsTrigger>
                <TabsTrigger value="markdown" className="gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  Markdown
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="json"
                className="space-y-2 mt-3 min-w-0 w-full max-w-full"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0 w-full max-w-full">
                  <Label className="text-sm font-medium">JSON 格式</Label>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyJson}
                      disabled={!jsonOutput}
                      className="gap-1.5 h-8 text-xs"
                    >
                      {copiedJson ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>复制</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadJson}
                      disabled={!jsonOutput}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>下载</span>
                    </Button>
                  </div>
                </div>
                <div className="w-full min-w-0 max-w-full border border-input rounded-md shadow-xs overflow-hidden">
                  <ScrollArea className="h-[250px]">
                    <div className="min-h-[250px] font-mono text-xs px-3 py-2 break-all wrap-break-word whitespace-pre-wrap min-w-0 w-full max-w-full box-border block">
                      {jsonOutput || '暂无数据，请在上方输入表格数据'}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent
                value="markdown"
                className="space-y-2 mt-3 min-w-0 w-full max-w-full"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0 w-full max-w-full">
                  <Label className="text-sm font-medium">Markdown 格式</Label>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyMarkdown}
                      disabled={!markdownOutput}
                      className="gap-1.5 h-8 text-xs"
                    >
                      {copiedMarkdown ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>复制</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadMarkdown}
                      disabled={!markdownOutput}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>下载</span>
                    </Button>
                  </div>
                </div>
                <div className="w-full min-w-0 max-w-full border border-input rounded-md shadow-xs overflow-hidden">
                  <ScrollArea className="h-[250px]">
                    <div className="min-h-[250px] font-mono text-xs px-3 py-2 break-all wrap-break-word whitespace-pre-wrap min-w-0 w-full max-w-full box-border block">
                      {markdownOutput || '暂无数据，请在上方输入表格数据'}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 预览区域 - 堆叠在输出区域下方 */}
        {table.length > 0 && (
          <Card className="border-t-0 rounded-t-none w-full overflow-hidden">
            <CardHeader className="pb-3 min-w-0">
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <Table2 className="h-4 w-4 shrink-0 text-primary" />
                数据预览
              </CardTitle>
              <CardDescription className="text-xs mt-1.5 text-muted-foreground">
                解析后的表格结构预览
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 overflow-hidden w-full">
              <div className="w-full">
                <TablePreview data={jsonData} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 空状态提示 - 堆叠在最后 */}
        {!input && (
          <Card className="border-dashed min-w-0 border-t-0 rounded-t-none">
            <CardContent className="flex flex-col items-center justify-center py-8 min-w-0">
              <Table2 className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
              <h3 className="text-base font-semibold mb-1">开始转换表格数据</h3>
              <p className="text-xs text-muted-foreground text-center mb-3 max-w-md">
                从 Excel
                复制表格数据并粘贴到上方输入框，或点击"示例数据"查看示例
              </p>
              <Button
                variant="outline"
                onClick={handleLoadExample}
                className="gap-1.5 h-8 text-xs"
              >
                <FileText className="h-3.5 w-3.5" />
                加载示例数据
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
