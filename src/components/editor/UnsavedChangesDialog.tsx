import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({ open, onSave, onDiscard, onCancel }: Props) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="bg-card rounded-2xl border border-border shadow-xl p-6 sm:p-8 w-full max-w-[24rem] space-y-5">
        <div>
          <h2 className="text-lg font-bold text-foreground font-heebo">שינויים שלא נשמרו</h2>
          <p className="text-sm text-muted-foreground mt-1 font-heebo">
            יש שינויים שטרם נשמרו. מה ברצונך לעשות?
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            onClick={onSave}
            className="w-full font-heebo"
            style={{ backgroundColor: '#21AEFF' }}
          >
            שמור טיוטה וצא
          </Button>
          <Button
            variant="outline"
            onClick={onDiscard}
            className="w-full font-heebo text-red-600 border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            צא ללא שמירה
          </Button>
          <Button variant="ghost" onClick={onCancel} className="w-full font-heebo">
            ביטול
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
