import { useState } from 'react'
import useSWR from 'swr'
import Tabs from '../components/Tabs'
import HistoryChart, { Point } from '../components/HistoryChart'
import FutureDrawer from '../components/FutureDrawer'
import AnnualChart from '../components/AnnualChart'
import totalsStyles from '../styles/Totals.module.css'
import styles from '../styles/Index.module.css'
import type { FutureResult } from '../components/FutureProjection'

const API = process.env.NEXT_PUBLIC_API_URL || '';

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function Home() {
  const [tab, setTab] = useState<'history' | 'future'>('history')
  const [symbol, setSymbol] = useState('VUAA.DE')
  const { data: history, error: historyError } = useSWR<Point[]>(
    tab === 'history' ? `${API}/stock/history?symbol=${symbol}` : null,
    fetcher
  )
  const [futureResult, setFutureResult] = useState<FutureResult>()

  const formatCurrency = (n: number): string =>
    n.toLocaleString(undefined, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Ashe Investment Dashboard</h1>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Tabs
          tabs={[
            { id: 'history', label: 'History' },
            { id: 'future', label: 'Future' }
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'history' && (
        <section>
          <div style={{ textAlign: 'center', margin: '0 auto 16px', maxWidth: 400 }}>
            <input
              className={styles.symbolInput}
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="Enter symbol (e.g. VUAA.DE)"
            />
          </div>
          {historyError && (
            <p style={{ color: '#dc2626', textAlign: 'center' }}>
              Failed to load history
            </p>
          )}
          {!history && !historyError && (
            <p style={{ textAlign: 'center' }}>Loading…</p>
          )}
          {history && <HistoryChart data={history} />}
        </section>
      )}

      {tab === 'future' && (
        <section>
          <FutureDrawer onResult={setFutureResult} />

          {futureResult && (
            <>
              <div className={totalsStyles.totals}>
                <div className={totalsStyles.card}>
                  <div className={totalsStyles.label}>Total Contributed</div>
                  <div className={totalsStyles.value}>
                    {formatCurrency(futureResult.total_contributions)}
                  </div>
                </div>
                <div className={totalsStyles.card}>
                  <div className={totalsStyles.label}>Projected Value</div>
                  <div className={totalsStyles.value}>
                    {formatCurrency(futureResult.projected_value)}
                  </div>
                </div>
              </div>
              <AnnualChart data={futureResult.annual_balances} />
            </>
          )}
        </section>
      )}
    </div>
  )
}
