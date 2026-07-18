import { useParams } from 'react-router-dom'
import ComingSoon from './ComingSoon.jsx'

export default function PostDetailPlaceholder() {
  const { postId } = useParams()
  return <ComingSoon title="Post" subtitle={`Post #${postId}`} />
}