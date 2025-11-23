import { useEffect, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'
import NProgress from 'nprogress'

if (typeof window !== 'undefined') {
    NProgress.configure({
        showSpinner: false,
        trickleSpeed: 200,
        minimum: 0.3,
    })
}

export function RouteProgress() {
    const router = useRouter()
    const hasResolvedOnceRef = useRef(false)

    useEffect(() => {
        const stopBeforeLoad = router.subscribe('onBeforeLoad', ({ pathChanged }) => {
            // 只有在路径真正改变且不是初始加载时才显示进度条
            if (pathChanged && hasResolvedOnceRef.current) {
                NProgress.start()
            }
        })

        const stopResolved = router.subscribe('onResolved', ({ pathChanged }) => {
            // 标记已经至少解析过一次
            if (!hasResolvedOnceRef.current) {
                hasResolvedOnceRef.current = true
            }

            // 只有在路径真正改变且不是初始加载时才隐藏进度条
            if (pathChanged && hasResolvedOnceRef.current) {
                NProgress.done()
            }
        })

        return () => {
            stopBeforeLoad()
            stopResolved()
        }
    }, [router])

    return null
}

