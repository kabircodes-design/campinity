import { useParams } from 'react-router-dom'
import ComingSoon from './ComingSoon.jsx'

export default function EventDetailPlaceholder() {
  const { eventId } = useParams()
  return <ComingSoon title="Event Details" subtitle={eventId} />
}