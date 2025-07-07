import { FC } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts'
import cardStyles from '../styles/Card.module.css'

interface Props {
  data: Record<number, number>
}

const AnnualChart: FC<Props> = ({ data }) => {
  const chartData = Object.entries(data)
    .map(([year, value]) => ({ year: +year, value }))
    .sort((a, b) => a.year - b.year)

  const years = chartData.map(d => d.year)
  const values = chartData.map(d => d.value)
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)
  const maxValue = Math.max(...values)
  const pad = maxValue * 0.02 || 1

  const numTicks = Math.min(years.length, 10)
  const yearStep = (maxYear - minYear) / (numTicks - 1)
  const ticks = Array.from({ length: numTicks }, (_, i) =>
    Math.round(minYear + yearStep * i)
  )

  const formatCurrency = (n: number) =>
    n.toLocaleString(undefined, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })

  return (
    <div className={cardStyles.card}>
      <h3 className={cardStyles.title}>Projected Annual Balances</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 20, bottom: 20, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            type="number"
            dataKey="year"
            domain={[minYear, maxYear]}
            ticks={ticks}
            tick={{ fontSize: 12, fill: '#666' }}
          />
          <YAxis
            domain={[0, maxValue + pad]}
            tick={{ fontSize: 12, fill: '#666' }}
            tickFormatter={formatCurrency}
            width={80}
          />
          <Tooltip
            formatter={(value: any) => [formatCurrency(Number(value)), 'Return']}
            labelFormatter={(label: any) => `Year ${label}`}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default AnnualChart
