import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import type { GenerationOptions } from '../types'

type SelectOption = { value: string; label: string }

function OptionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
}) {
  return (
    <TextField
      fullWidth
      label={label}
      select
      SelectProps={{ native: true }}
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </TextField>
  )
}

type HomeAdvancedOptionsPanelProps = {
  open: boolean
  options: GenerationOptions
  taskTypeLabel: string
  outputStyleLabel: string
  targetReadersLabel: string
  outputLanguageLabel: string
  taskTypeOptions: SelectOption[]
  outputStyleOptions: SelectOption[]
  targetReadersOptions: SelectOption[]
  outputLanguageOptions: SelectOption[]
  onTaskTypeChange: (value: string) => void
  onOutputStyleChange: (value: string) => void
  onTargetReadersChange: (value: string) => void
  onOutputLanguageChange: (value: GenerationOptions['outputLanguage']) => void
}

export function HomeAdvancedOptionsPanel({
  open,
  options,
  taskTypeLabel,
  outputStyleLabel,
  targetReadersLabel,
  outputLanguageLabel,
  taskTypeOptions,
  outputStyleOptions,
  targetReadersOptions,
  outputLanguageOptions,
  onTaskTypeChange,
  onOutputStyleChange,
  onTargetReadersChange,
  onOutputLanguageChange,
}: HomeAdvancedOptionsPanelProps) {
  if (!open) {
    return null
  }

  return (
    <Box
      sx={{
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { sm: 'repeat(2, minmax(0, 1fr))', xs: '1fr' },
        p: 2,
      }}
    >
      <OptionSelect
        label={taskTypeLabel}
        options={taskTypeOptions}
        value={options.taskType}
        onChange={onTaskTypeChange}
      />
      <OptionSelect
        label={outputStyleLabel}
        options={outputStyleOptions}
        value={options.outputStyle}
        onChange={onOutputStyleChange}
      />
      <OptionSelect
        label={targetReadersLabel}
        options={targetReadersOptions}
        value={options.targetReaders}
        onChange={onTargetReadersChange}
      />
      <OptionSelect
        label={outputLanguageLabel}
        options={outputLanguageOptions}
        value={options.outputLanguage}
        onChange={(value) => onOutputLanguageChange(value as GenerationOptions['outputLanguage'])}
      />
    </Box>
  )
}