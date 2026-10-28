import { LinkPicker } from '@/components/editor/LinkPicker'

type Props = {
  linkedIds: string[]
  onChange: (ids: string[]) => void
  bare?: boolean
}

export function TopicLinksSection({ linkedIds, onChange, bare }: Props) {
  return (
    <LinkPicker
      targetType="event"
      title="קישור דפי אירוע"
      guidance="קשר דפי אירוע רלוונטיים לדף נושא זה. ניתן לבחור יותר מאחד"
      linkedIds={linkedIds}
      onChange={onChange}
      bare={bare}
    />
  )
}
