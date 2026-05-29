import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { CaptionSegment } from '../../types'
import { buildYouTubeTimestampUrl, formatTimestamp } from '../../pages/session/sessionUtils'

export function SessionCaptionsContent({
  captionSegments,
  transcriptPreview,
  videoId,
  sectionTitle,
  segmentCountLabel,
  durationLabel,
  jumpToVideoLabel,
  fallbackLabel,
  emptyLabel,
}: {
  captionSegments: CaptionSegment[]
  transcriptPreview?: string
  videoId?: string | null
  sectionTitle: string
  segmentCountLabel: string
  durationLabel: string
  jumpToVideoLabel: string
  fallbackLabel: string
  emptyLabel: string
}) {
  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 600 }}>{sectionTitle}</Typography>
      </Box>

      {captionSegments.length > 0 ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.2,
              justifyContent: 'space-between',
            }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>
              {segmentCountLabel}
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>
              {durationLabel}
            </Typography>
          </Box>

          <Box
            sx={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--mui-palette-primary-main) 7%, transparent), transparent)',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              display: 'grid',
              gap: 1,
              maxHeight: { md: 560, xs: 420 },
              overflowY: 'auto',
              p: 1.2,
            }}
          >
            {captionSegments.map((segment, index) => (
              <Box
                key={`${segment.startMs}-${index}`}
                sx={{
                  backgroundColor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  display: 'grid',
                  gap: 1.2,
                  gridTemplateColumns: { sm: '7.5rem minmax(0, 1fr)', xs: '1fr' },
                  p: 1.2,
                }}
              >
                <Box sx={{ alignItems: 'flex-start', display: 'grid', gap: 0.8 }}>
                  <Typography
                    sx={{
                      color: 'text.secondary',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: 0.2,
                    }}
                  >
                    {formatTimestamp(segment.startMs)}
                  </Typography>

                  {videoId ? (
                    <Typography
                      component="a"
                      href={buildYouTubeTimestampUrl(videoId, segment.startMs)}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        alignItems: 'center',
                        backgroundColor: 'action.hover',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 99,
                        color: 'primary.main',
                        display: 'inline-flex',
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: 1,
                        px: 1,
                        py: 0.5,
                        textDecoration: 'none',
                        width: 'fit-content',
                        '&:hover': {
                          backgroundColor: 'primary.main',
                          borderColor: 'primary.main',
                          color: 'primary.contrastText',
                        },
                      }}
                    >
                      {jumpToVideoLabel}
                    </Typography>
                  ) : null}
                </Box>

                <Typography
                  sx={{ fontSize: 14, lineHeight: 1.75, overflowWrap: 'anywhere', whiteSpace: 'normal' }}
                >
                  {segment.text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ) : transcriptPreview ? (
        <Box sx={{ display: 'grid', gap: 1.2 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{fallbackLabel}</Typography>
          <Typography
            sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
          >
            {transcriptPreview}
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{emptyLabel}</Typography>
      )}
    </>
  )
}
