export interface BsInlineEditableTitleProps {
  ariaLabel: string
  headingLevel: 'h1' | 'h2'
  maxLength?: number
  onSave: (value: string) => void
  placeholder: string
  value: string
}
