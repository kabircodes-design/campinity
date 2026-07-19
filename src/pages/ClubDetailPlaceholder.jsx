import { useParams } from 'react-router-dom'
import ComingSoon from './ComingSoon.jsx'

export default function ClubDetailPlaceholder() {
  const { clubId } = useParams()
  return <ComingSoon title="Club Details" subtitle={clubId} />
}