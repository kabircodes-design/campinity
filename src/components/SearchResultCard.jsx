import StudentCard from './StudentCard.jsx'
import ClubCard from './ClubCard.jsx'
import EventCard from './EventCard.jsx'
import PDFCard from './PDFCard.jsx'

export default function SearchResultCard({ result }) {
  switch (result.type) {
    case 'student':
      return <StudentCard student={result} />
    case 'club':
      return <ClubCard club={result} />
    case 'event':
      return <EventCard event={result} />
    case 'notes':
      return <PDFCard note={result} />
    default:
      return null
  }
}