let isChecking = false;

export async function validateGrokApiKey(
  apiKey: string,
): Promise<boolean | null> {
  try {
    if (isChecking) return null;

    isChecking = true;
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error(error);
    return false;
  } finally {
    isChecking = false;
  }
}
