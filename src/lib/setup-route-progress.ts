import type { AnyRouter } from "@tanstack/react-router"
import NProgress from "nprogress"


if (typeof window !== "undefined") {
    NProgress.configure({
        showSpinner: false,
        trickleSpeed: 200,
        minimum: 0.3,
    })
}

export function setupRouteProgress(router: AnyRouter) {
    if (typeof window === "undefined") return () => { };
    const stopBeforeLoad = router.subscribe("onBeforeLoad", ({ pathChanged }) => {
        if (pathChanged) {
            NProgress.start()
        }
    })
    const stopResolved = router.subscribe("onResolved", ({ pathChanged }) => {
        if (pathChanged) {
            NProgress.done()
        }
    })
    return () => {
        stopBeforeLoad()
        stopResolved()
        NProgress.remove()
    }
}