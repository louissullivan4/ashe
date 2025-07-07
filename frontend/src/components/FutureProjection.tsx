import { FC, useState, useEffect, FormEvent } from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import styles from '../styles/FutureProjection.module.css'

const API = process.env.NEXT_PUBLIC_API_URL || '';
export interface FutureResult {
  symbol: string
  years: number
  basis: string
  contribution_per_period: number
  periods_per_year: number
  annual_return_used: number
  total_contributions: number
  projected_value: number
  annual_balances: Record<number, number>
}

interface Props { onResult: (res: FutureResult) => void }

const STORAGE_KEY = 'ashe_future_last'

const FutureProjection: FC<Props> = ({ onResult }) => {
  const [symbol, setSymbol] = useState('VUAA.DE')
  const [years, setYears] = useState(30)
  const [amount, setAmount] = useState(250)
  const [basis, setBasis] = useState<'monthly'|'weekly'>('monthly')
  const [annualReturn, setAnnualReturn] = useState<number>(10)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) onResult(JSON.parse(stored))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const decimalReturn = annualReturn / 100
    const base = new URLSearchParams({
      symbol,
      years: String(years),
      amount: String(amount),
      basis,
      annual_return: String(decimalReturn)
    })
    const annRes = await fetch(`${API}/stock/future?${base.toString()}&output=annual`)
    const annJson = await annRes.json()
    const totRes = await fetch(`${API}/stock/future?${base.toString()}`)
    const totJson = await totRes.json()
    const merged: FutureResult = {
      ...totJson,
      annual_balances: annJson.annual_balances!,
      projected_value: totJson.projected_value!
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    onResult(merged)
  }

  return (
    <div className={styles.card}>
      <form onSubmit={submit} className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor="symbol" className={styles.label}>Symbol</label>
          <input
            id="symbol"
            className={styles.input}
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder="e.g. VUAA.DE"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="years" className={styles.label}>Years</label>
          <input
            id="years"
            type="number"
            className={styles.input}
            value={years}
            min={1}
            onChange={e => setYears(+e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="amount" className={styles.label}>Amount / Period (€)</label>
          <input
            id="amount"
            type="number"
            className={styles.input}
            value={amount}
            min={1}
            onChange={e => setAmount(+e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="annualReturn" className={styles.label}>Annual Return (%)</label>
          <input
            id="annualReturn"
            type="number"
            className={styles.input}
            value={annualReturn}
            min={1}
            max={100}
            step={1}
            onChange={e => setAnnualReturn(Math.min(100, Math.max(1, +e.target.value)))}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="basis" className={styles.label}>Frequency</label>
          <select
            id="basis"
            className={styles.select}
            value={basis}
            onChange={e => setBasis(e.target.value as any)}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <button type="submit" className={styles.button}>
          <FiRefreshCw size={20} />
        </button>
      </form>
    </div>
  )
}

export default FutureProjection