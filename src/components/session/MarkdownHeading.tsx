import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownHeading({
  level,
  children,
  buttonLabel,
  loadingLabel,
  summary,
  isLoading,
  onSummarize,
}: {
  level: 1 | 2 | 3 | 4 | 5 | 6
  children: ReactNode
  buttonLabel: string
  loadingLabel: string
  summary?: string
  isLoading: boolean
  onSummarize?: () => void
}) {
  const headingTag = {
    1: 'h1',
    2: 'h2',
    3: 'h3',
    4: 'h4',
    5: 'h5',
    6: 'h6',
  }[level] as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1,
        my: level === 1 ? 0 : 1.5,
      }}
    >
      <Box
        component={headingTag}
        sx={{
          alignItems: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.2,
          justifyContent: 'space-between',
          lineHeight: 1.2,
          m: 0,
        }}
      >
        <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 700 }}>
          {children}
        </Typography>
        <Button
          disabled={!onSummarize || isLoading}
          size="small"
          variant="outlined"
          onClick={onSummarize}
          startIcon={isLoading ? <CircularProgress size={12} /> : null}
        >
          {isLoading ? loadingLabel : buttonLabel}
        </Button>
      </Box>

      {summary ? (
        <Box
          sx={{
            backgroundColor: 'action.hover',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            color: 'text.secondary',
            fontSize: 13,
            lineHeight: 1.7,
            p: 1.2,
            '& p': {
              m: 0,
            },
            '& p + p': {
              mt: 0.8,
            },
            '& ul, & ol': {
              m: 0,
              mt: 0.8,
              pl: 2.4,
            },
            '& li + li': {
              mt: 0.35,
            },
            '& code': {
              fontFamily:
                'ui-monospace, SFMono-Regular, SF Mono, Consolas, Liberation Mono, monospace',
              fontSize: '0.92em',
            },
            '& a': {
              color: 'primary.main',
            },
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
        </Box>
      ) : null}
    </Box>
  )
}
