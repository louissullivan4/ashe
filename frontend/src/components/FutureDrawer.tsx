import { FC, useState } from 'react'
import { FiMenu, FiX } from 'react-icons/fi'
import FutureProjection, { FutureResult } from './FutureProjection'
import styles from '../styles/FutureDrawer.module.css'

interface Props {
  onResult: (res: FutureResult) => void
}

const FutureDrawer: FC<Props> = ({ onResult }) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className={styles.burger} onClick={() => setOpen(o => !o)}>
        {open ? <FiX size={24}/> : <FiMenu size={24}/>}
      </div>

      <div className={`${styles.drawer} ${open ? styles.open : ''}`}>
        <FutureProjection onResult={onResult} />
      </div>
    </>
  )
}

export default FutureDrawer
