import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

type HomeUrlInputSectionProps = {
  youtubeUrl: string
  error: string
  urlLabel: string
  urlPlaceholder: string
  generateLabel: string
  advancedOptionsLabel: string
  onYoutubeUrlChange: (value: string) => void
  onToggleAdvanced: () => void
}

export function HomeUrlInputSection({
  youtubeUrl,
  error,
  urlLabel,
  urlPlaceholder,
  generateLabel,
  advancedOptionsLabel,
  onYoutubeUrlChange,
  onToggleAdvanced,
}: HomeUrlInputSectionProps) {
  return (
    <>
      <TextField
        fullWidth
        label={urlLabel}
        placeholder={urlPlaceholder}
        sx={{ '& .MuiInputBase-input': { fontSize: 16, py: 1.9 } }}
        value={youtubeUrl}
        onChange={(event) => onYoutubeUrlChange(event.target.value)}
      />

      <Stack direction={{ sm: 'row', xs: 'column' }} spacing={1.5}>
        <Button
          sx={{ px: 2.5, py: 1.1 }}
          type="submit"
          variant="contained"
        >
          {generateLabel}
        </Button>
        <Button
          sx={{ px: 2.5, py: 1.1 }}
          type="button"
          variant="outlined"
          onClick={onToggleAdvanced}
        >
          {advancedOptionsLabel}
        </Button>
      </Stack>

      {error ? (
        <Typography
          sx={(theme) => ({
            backgroundColor: theme.palette.error.light,
            border: `1px solid ${theme.palette.error.main}`,
            color: theme.palette.error.contrastText,
            fontSize: 14,
            px: 2,
            py: 1.5,
          })}
        >
          {error}
        </Typography>
      ) : null}
    </>
  )
}