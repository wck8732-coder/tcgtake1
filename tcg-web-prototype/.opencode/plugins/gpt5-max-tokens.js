// gpt5-max-tokens.js
// Azure OpenAI deployments of gpt-5-mini reject the legacy `max_tokens`
// parameter ("Unsupported parameter: 'max_tokens' ... Use 'max_completion_tokens'
// instead"). opencode's openai-compatible SDK serializes max_tokens from the
// chat maxOutputTokens setting. Clearing it makes the SDK drop the field from
// the request body entirely, which the deployment accepts (defaults apply).
export const Gpt5MaxTokensFix = async () => {
  return {
    "chat.params": async (input, output) => {
      const { provider, model } = input
      const providerId = provider?.id || provider?.info?.id
      if (
        providerId === "azure" &&
        (model?.id === "gpt-5-mini" || model?.id?.includes?.("gpt-5"))
      ) {
        output.maxOutputTokens = undefined
      }
    },
  }
}