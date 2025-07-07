import { FC } from 'react'
import styles from '../styles/Tabs.module.css'

interface Tab { id: 'history' | 'future'; label: string }
interface Props {
  tabs: Tab[]
  active: Tab['id']
  onChange: (id: Tab['id']) => void
}

const Tabs: FC<Props> = ({ tabs, active, onChange }) => (
  <div className={styles.container}>
    {tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`${styles.button} ${tab.id === active ? styles.active : ''}`}
      >
        {tab.label}
      </button>
    ))}
  </div>
)

export default Tabs
