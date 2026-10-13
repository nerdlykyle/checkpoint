import { Plus } from 'lucide-react'
import './RadarAddButton.css'

export default function RadarAddButton({ onClick }: { onClick: () => void }) {
  return <button className="radar-add" type="button" onClick={onClick}><span aria-hidden="true"><Plus size={21} /></span><strong>Add to the radar</strong><small>Suggest something new</small></button>
}
