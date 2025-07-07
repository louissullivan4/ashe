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

export type Point = { date: string; close: number }

interface Props {
  data: Point[] | Record<string, any>
  title?: string
}

const HistoryChart: FC<Props> = ({ data, title = 'Price History' }) => {
  let chartData: Point[] = Array.isArray(data)
    ? (data as Point[])
    : Object.entries(data).map(([date, vals]) => ({
        date: date.slice(0, 10),
        close: +vals['4. close']
      }))

  chartData = chartData
    .map(p => ({ ...p, date: p.date.slice(0, 10) }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const recent = chartData.slice(-100)

  const closes = recent.map(p => p.close)
  const minClose = Math.min(...closes)
  const maxClose = Math.max(...closes)
  const rawRange = maxClose - minClose
  const padding = rawRange > 0
    ? rawRange * 0.02
    : maxClose * 0.02 || 1

  const formatDate = (d: string) => {
    const dt = new Date(d)
    return dt.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
  }
  const formatEuro = (v: number) => `€${v.toFixed(2)}`

  return (
    <div className={cardStyles.card}>
      <h3 className={cardStyles.title}>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={recent}
          margin={{ top: 10, right: 20, bottom: 20, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#ECECEC" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            interval="preserveStartEnd"
            minTickGap={20}
            tick={{ fontSize: 12, fill: '#666' }}
          />
          <YAxis
            domain={[minClose - padding, maxClose + padding]}
            tickFormatter={formatEuro}
            tick={{ fontSize: 12, fill: '#666' }}
            width={80}
          />
          <Tooltip
            formatter={(value: any) => formatEuro(value as number)}
            labelFormatter={(label: string) => {
              const dt = new Date(label)
              return dt.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })
            }}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default HistoryChart
