import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Step from '@mui/material/Step'
import StepContent from '@mui/material/StepContent'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import Typography from '@mui/material/Typography'
import { useMemo } from 'react'
import type { SessionRecord } from '../../types'
import type { GenerationStage } from '../../pages/session/sessionGeneration'
import type { StageErrorMap } from '../../pages/session/sessionUtils'

export function SessionSidebar({
  session,
  generationStage,
  stageErrors,
  statusText,
  detailsLines,
  retryLabel,
  deleteLabel,
  statusLabel,
  detailsLabel,
  errorPrefix,
  fetchSubsLabel,
  generateArticleLabel,
  stageInProgressLabel,
  stageCompletedLabel,
  stagePendingLabel,
  streamingProgressText,
  generationSpeedText,
  onRetry,
  onDelete,
}: {
  session: SessionRecord
  generationStage: GenerationStage
  stageErrors: StageErrorMap
  statusText: string
  detailsLines: string[]
  retryLabel: string
  deleteLabel: string
  statusLabel: string
  detailsLabel: string
  errorPrefix: string
  fetchSubsLabel: string
  generateArticleLabel: string
  stageInProgressLabel: string
  stageCompletedLabel: string
  stagePendingLabel: string
  streamingProgressText: string
  generationSpeedText: string
  onRetry: () => void
  onDelete: () => void
}) {
  const activeStep = useMemo(() => {
    if (session.status === 'completed') {
      return 2
    }

    return generationStage === 'fetchingSubs' ? 0 : 1
  }, [generationStage, session.status])

  const showStageFlow =
    session.status === 'generating' || session.status === 'failed' || session.status === 'completed'

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
      }}
    >
      <Box sx={{ display: 'grid', gap: 2.5 }}>
        <Box>
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{statusLabel}</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 600, mt: 0.5 }}>{statusText}</Typography>
        </Box>

        <Box>
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{detailsLabel}</Typography>
          <Box
            sx={{
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              color: 'text.secondary',
              display: 'grid',
              fontSize: 14,
              gap: 1.2,
              mt: 1.5,
              p: 2,
            }}
          >
            <Typography sx={{ overflowWrap: 'anywhere' }}>{session.youtubeUrl}</Typography>
            {detailsLines.map((line) => (
              <Typography key={line}>{line}</Typography>
            ))}
          </Box>
        </Box>

        {showStageFlow ? (
          <Stepper activeStep={activeStep} orientation="vertical">
            <Step completed={session.status === 'completed' || generationStage === 'generatingArticle'}>
              <StepLabel error={Boolean(stageErrors.fetchingSubs)}>{fetchSubsLabel}</StepLabel>
              <StepContent>
                <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                  {session.status === 'generating' && generationStage === 'fetchingSubs' ? (
                    <CircularProgress size={16} />
                  ) : null}
                  <Typography
                    sx={{
                      color: stageErrors.fetchingSubs ? 'error.main' : 'text.secondary',
                      fontSize: 13,
                    }}
                  >
                    {stageErrors.fetchingSubs
                      ? stageErrors.fetchingSubs
                      : generationStage === 'fetchingSubs' && session.status === 'generating'
                        ? stageInProgressLabel
                        : stageCompletedLabel}
                  </Typography>
                </Box>
              </StepContent>
            </Step>

            <Step completed={session.status === 'completed'}>
              <StepLabel error={Boolean(stageErrors.generatingArticle)}>{generateArticleLabel}</StepLabel>
              <StepContent>
                <Box sx={{ display: 'grid', gap: 0.8 }}>
                  <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                    {session.status === 'generating' && generationStage === 'generatingArticle' ? (
                      <CircularProgress size={16} />
                    ) : null}
                    <Typography
                      sx={{
                        color: stageErrors.generatingArticle ? 'error.main' : 'text.secondary',
                        fontSize: 13,
                      }}
                    >
                      {stageErrors.generatingArticle
                        ? stageErrors.generatingArticle
                        : generationStage === 'generatingArticle' && session.status === 'generating'
                          ? stageInProgressLabel
                          : stagePendingLabel}
                    </Typography>
                  </Box>
                  {session.status === 'generating' && generationStage === 'generatingArticle' ? (
                    <>
                      <Typography sx={{ fontSize: 13 }}>{streamingProgressText}</Typography>
                      <Typography sx={{ fontSize: 13 }}>{generationSpeedText}</Typography>
                    </>
                  ) : null}
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        ) : null}

        {session.error && !stageErrors.fetchingSubs && !stageErrors.generatingArticle ? (
          <Box
            sx={{
              backgroundColor: 'error.light',
              border: '1px solid',
              borderColor: 'error.main',
              color: 'error.contrastText',
              fontSize: 14,
              px: 2,
              py: 1.5,
            }}
          >
            {errorPrefix} {session.error}
          </Box>
        ) : null}

        {(session.status === 'failed' || session.status === 'completed') && (
          <Button variant="contained" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}

        <Button disabled={session.status === 'generating'} color="error" variant="outlined" onClick={onDelete}>
          {deleteLabel}
        </Button>
      </Box>
    </Paper>
  )
}
