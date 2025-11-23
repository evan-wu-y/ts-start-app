import { createFileRoute } from '@tanstack/react-router'
import { DashboardNotFound } from '@/components/not-found'

export const Route = createFileRoute('/_dashboardLayout/$')({
  component: DashboardNotFound,
})