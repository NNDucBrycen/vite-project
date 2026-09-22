import captionData from '../../caption.json'

export interface Caption {
  BUSINESS_ID?: string
  APPLICATION_ID?: string
  WORK_ID?: string
  CAPTION_ID?: string
  LABEL: string
}

export const CAPTIONS: Caption[] = captionData

export function captionKey(caption: Caption): string {
  const ids = [caption.BUSINESS_ID, caption.APPLICATION_ID, caption.WORK_ID, caption.CAPTION_ID]
    .map((id) => id?.trim())
    .filter((id): id is string => !!id)
  return `{${ids.join('.')}}`
}

const captionsByKey = new Map(CAPTIONS.map((caption) => [captionKey(caption), caption]))

export function getCaption(key: string): Caption | undefined {
  return captionsByKey.get(key)
}
