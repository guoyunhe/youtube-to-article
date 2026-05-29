import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SessionRecord, SessionSection } from '../../types'
import { MarkdownHeading } from './MarkdownHeading'

export function SessionArticleContent({
  session,
  summarizeError,
  summarizingSectionId,
  flattenedSections,
  titleFallback,
  articleFallback,
  summarizeHeadingLabel,
  summarizingHeadingLabel,
  onSummarizeSection,
}: {
  session: SessionRecord
  summarizeError: string
  summarizingSectionId: string | null
  flattenedSections: SessionSection[]
  titleFallback: string
  articleFallback: string
  summarizeHeadingLabel: string
  summarizingHeadingLabel: string
  onSummarizeSection: (sectionId: string) => void
}) {
  let headingRenderIndex = 0
  const resolveSectionForHeading = (): SessionSection | undefined => {
    const section = flattenedSections[headingRenderIndex]
    headingRenderIndex += 1
    return section
  }

  const headingLevels = [1, 2, 3, 4, 5, 6] as const

  const headingComponents = Object.fromEntries(
    headingLevels.map((level) => [
      `h${level}`,
      ({ children }: { children?: ReactNode }) => {
        const section = resolveSectionForHeading()

        return (
          <MarkdownHeading
            level={level}
            buttonLabel={summarizeHeadingLabel}
            loadingLabel={summarizingHeadingLabel}
            summary={section?.summary}
            isLoading={summarizingSectionId === section?.id}
            onSummarize={
              section && !summarizingSectionId && session.status !== 'generating'
                ? () => onSummarizeSection(section.id)
                : undefined
            }
          >
            {children}
          </MarkdownHeading>
        )
      },
    ]),
  )

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 32, fontWeight: 600 }}>{session.title ?? titleFallback}</Typography>
      </Box>

      {summarizeError ? (
        <Box
          sx={{
            backgroundColor: 'error.light',
            border: '1px solid',
            borderColor: 'error.main',
            borderRadius: 1.5,
            color: 'error.contrastText',
            fontSize: 13,
            mb: 2,
            p: 1.2,
          }}
        >
          {summarizeError}
        </Box>
      ) : null}

      {session.article ? (
        <Box
          component="article"
          sx={{
            fontSize: 14,
            lineHeight: 1.8,
            '& > :first-of-type': {
              mt: 0,
            },
            '& > :last-child': {
              mb: 0,
            },
            '& p, & ul, & ol, & blockquote, & pre, & table': {
              my: 1.5,
            },
            '& ul, & ol': {
              pl: 3,
            },
            '& li + li': {
              mt: 0.75,
            },
            '& blockquote': {
              borderLeft: '4px solid',
              borderColor: 'divider',
              color: 'text.secondary',
              pl: 2,
            },
            '& pre': {
              overflowX: 'auto',
              p: 2,
              borderRadius: 2,
              backgroundColor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
            },
            '& code': {
              fontFamily:
                'ui-monospace, SFMono-Regular, SF Mono, Consolas, Liberation Mono, monospace',
              fontSize: '0.95em',
            },
            '& a': {
              color: 'primary.main',
            },
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& th, & td': {
              border: '1px solid',
              borderColor: 'divider',
              px: 1.25,
              py: 0.75,
              textAlign: 'left',
              verticalAlign: 'top',
            },
            '& th': {
              backgroundColor: 'background.default',
              fontWeight: 600,
            },
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={headingComponents}>
            {session.article}
          </ReactMarkdown>
        </Box>
      ) : (
        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{articleFallback}</Typography>
      )}
    </>
  )
}
