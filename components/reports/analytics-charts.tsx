"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
} from "recharts"
import {
  ArrowUp,
  ArrowDown,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Layers,
} from "lucide-react"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AnalyticsData } from "@/lib/analytics"

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

const revenueChartConfig = {
  revenue: {
    label: "Revenue",
    color: "oklch(0.623 0.214 259.814)",
  },
  expenses: {
    label: "Expenses",
    color: "oklch(0.577 0.245 27.325)",
  },
  profit: {
    label: "Profit",
    color: "oklch(0.657 0.199 145.801)",
  },
} satisfies ChartConfig

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompact(value: number) {
  if (value >= 1_000_000) {
    return `Rp${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`
  }
  if (value >= 1_000) {
    return `Rp${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })}rb`
  }
  return formatCurrency(value)
}

interface StatCardProps {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  valueClassName?: string
}

function StatCard({ label, value, icon: Icon, valueClassName }: StatCardProps) {
  return (
    <div className="rounded-lg border p-3 sm:p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`mt-1 text-xl font-bold tracking-tight sm:text-2xl ${valueClassName ?? ""}`}>
        {value}
      </p>
    </div>
  )
}

export function ReportsAnalyticsCharts({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCompact(data.summary.totalRevenue)}
          icon={TrendingUp}
          valueClassName="text-emerald-600"
        />
        <StatCard
          label="Total Expenses"
          value={formatCompact(data.summary.totalExpenses)}
          icon={ShoppingCart}
          valueClassName="text-red-500"
        />
        <StatCard
          label="Net Profit"
          value={formatCompact(data.summary.netProfit)}
          icon={DollarSign}
          valueClassName={data.summary.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}
        />
        <StatCard
          label="Total Sales"
          value={data.summary.totalSales.toLocaleString("id-ID")}
          icon={Layers}
        />
      </div>

      <div className="rounded-lg border p-3 sm:p-4">
        <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Monthly Trend</h2>
        {data.monthly.length > 0 ? (
          <ChartContainer config={revenueChartConfig} className="h-[250px] w-full sm:h-[300px]">
            <BarChart data={data.monthly} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 6)}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCompact(value)}
                className="text-xs"
              />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="revenue" name="Revenue" fill="var(--color-revenue)" radius={4} />
              <Bar dataKey="expenses" name="Expenses" fill="var(--color-expenses)" radius={4} />
              <Bar dataKey="profit" name="Profit" fill="var(--color-profit)" radius={4} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground sm:h-[300px]">
            No data available
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border p-3 sm:p-4">
          <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Sales Channel</h2>
          {data.byChannel.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(180px,240px)] lg:items-center">
              <ChartContainer
                config={
                  Object.fromEntries(
                    data.byChannel.map((c, i) => [
                      c.channel,
                      { label: c.channel, color: COLORS[i % COLORS.length] },
                    ]),
                  ) as ChartConfig
                }
                className="mx-auto h-[200px] w-full max-w-[240px] sm:h-[240px]"
              >
                <PieChart>
                  <Pie
                    data={data.byChannel.map((c, i) => ({ ...c, fill: COLORS[i % COLORS.length] }))}
                    dataKey="total"
                    nameKey="channel"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {data.byChannel.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />}
                  />
                </PieChart>
              </ChartContainer>

              <div className="space-y-1.5">
                {data.byChannel.map((item, index) => (
                  <div key={item.channel} className="flex min-w-0 items-center gap-2 text-xs">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{item.channel}</span>
                    <span className="text-muted-foreground">
                      {formatCompact(item.total)}
                    </span>
                    <span className="w-8 text-right text-muted-foreground">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              No channel data available
            </div>
          )}
        </div>

        <div className="rounded-lg border p-3 sm:p-4">
          <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Top Products</h2>
          {data.topProducts.length > 0 ? (
            <div className="space-y-3">
              {data.topProducts.map((product, index) => {
                const maxTotal = data.topProducts[0].total
                const width = maxTotal > 0 ? (product.total / maxTotal) * 100 : 0
                return (
                  <div key={product.productId} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
                        <span className="min-w-0 truncate text-sm font-medium">{product.productName}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xs font-semibold">{formatCompact(product.total)}</span>
                        <span className="ml-1 text-[10px] text-muted-foreground">({product.qty}x)</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500/70"
                        style={{ width: `${Math.max(width, 2)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              No product data available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
