import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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

type HomeUrlInputSectionProps = {
  youtubeUrl: string
  youtubeUrlError: string
  options: GenerationOptions
  urlLabel: string
  urlPlaceholder: string
  generateLabel: string
  taskTypeLabel: string
  outputStyleLabel: string
  targetReadersLabel: string
  customPromptLabel: string
  customPromptPlaceholder: string
  taskTypeOptions: SelectOption[]
  outputStyleOptions: SelectOption[]
  targetReadersOptions: SelectOption[]
  onYoutubeUrlChange: (value: string) => void
  onYoutubeUrlBlur: () => void
  onTaskTypeChange: (value: string) => void
  onOutputStyleChange: (value: string) => void
  onTargetReadersChange: (value: string) => void
  onCustomPromptChange: (value: string) => void
}

export function HomeUrlInputSection({
  youtubeUrl,
  youtubeUrlError,
  options,
  urlLabel,
  urlPlaceholder,
  generateLabel,
  taskTypeLabel,
  outputStyleLabel,
  targetReadersLabel,
  customPromptLabel,
  customPromptPlaceholder,
  taskTypeOptions,
  outputStyleOptions,
  targetReadersOptions,
  onYoutubeUrlChange,
  onYoutubeUrlBlur,
  onTaskTypeChange,
  onOutputStyleChange,
  onTargetReadersChange,
  onCustomPromptChange,
}: HomeUrlInputSectionProps) {
  return (
    <>
      <TextField
        error={Boolean(youtubeUrlError)}
        fullWidth
        helperText={youtubeUrlError}
        label={urlLabel}
        placeholder={urlPlaceholder}
        sx={{ '& .MuiInputBase-input': { fontSize: 16, py: 1.9 } }}
        value={youtubeUrl}
        onBlur={onYoutubeUrlBlur}
        onChange={(event) => onYoutubeUrlChange(event.target.value)}
      />

      <Box
        sx={{
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { md: 'repeat(3, minmax(0, 1fr))', xs: '1fr' },
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
        <TextField
          fullWidth
          label={customPromptLabel}
          minRows={3}
          multiline
          placeholder={customPromptPlaceholder}
          sx={{ gridColumn: { md: '1 / -1', xs: 'auto' } }}
          value={options.customPrompt}
          onChange={(event) => onCustomPromptChange(event.target.value)}
        />
      </Box>

      <Button
        sx={{ px: 2.5, py: 1.1, width: { sm: 'fit-content', xs: '100%' } }}
        type="submit"
        variant="contained"
      >
        {generateLabel}
      </Button>
    </>
  )
}