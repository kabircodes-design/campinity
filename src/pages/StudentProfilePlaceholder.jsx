import { useParams } from 'react-router-dom'
import ComingSoon from './ComingSoon.jsx'

export default function StudentProfilePlaceholder() {
  const { username } = useParams()
  return <ComingSoon title="Student Profile" subtitle={`@${username}`} />
}