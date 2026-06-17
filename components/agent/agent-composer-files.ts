type NamedFileAttachment = {
  file: {
    name: string;
  };
};

export function formatAgentComposerFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;
  }

  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes >= 100 ? 0 : 1)} MB`;
}

export function summarizeAgentFileAttachments(fileAttachments: NamedFileAttachment[]) {
  if (!fileAttachments.length) {
    return "";
  }

  return `Attached ${fileAttachments.length} file${fileAttachments.length === 1 ? "" : "s"}: ${fileAttachments
    .map((item) => item.file.name)
    .join(", ")}.`;
}
