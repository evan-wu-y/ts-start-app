import { createRouter } from '@tanstack/react-router'

// Import the generated route tree
import { routeTree } from './routeTree.gen'
import { NotFound } from './components/not-found'

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultViewTransition: true,
    // 使用 fuzzy 模式，让最近的有 notFoundComponent 的父路由处理 404
    notFoundMode: 'fuzzy',
    defaultNotFoundComponent: () => <NotFound />,
  })

  return router
}
