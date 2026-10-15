# Render deployment

This package deploys Mickey Studio as a PHP web service on Render using the repository's Dockerfile.

## Render settings

- Service type: Web Service
- Runtime: Docker
- Plan: Free
- No secret key files are included in this package.
- Add `GEMINI_API_KEY` in Render's Environment settings if Gemini generation should be enabled. Keep the value in Render's secret environment settings; do not add it to GitHub.

The included `router.php` routes `/api.php` to the API and blocks direct web access to provider-key files and other PHP files. Render's free filesystem is temporary, so provider keys entered through the admin panel may be lost when the service restarts; a Render environment variable is the persistent option for the Gemini key.
