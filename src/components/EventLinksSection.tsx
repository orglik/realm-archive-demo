import { LinkPicker } from '@/components/editor/LinkPicker'

type Props = {
  linkedIds: string[]
  onChange: (ids: string[]) => void
  bare?: boolean
}

export function EventLinksSection({ linkedIds, onChange, bare }: Props) {
  return (
    <LinkPicker
      targetType="topic"
      title="קישור דפי נושא"
      guidance="קשר דף נושא קיים אחד או יותר שאליו שייך דף אירוע זה. נדרש לפחות דף נושא אחד כדי לפרסם."
      required
      linkedIds={linkedIds}
      onChange={onChange}
      bare={bare}
    />
  )
}
