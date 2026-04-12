# Font Assets — Required for PDF Certificate Generation

Place the following font files in this directory before running the application:

| File                | Purpose                                         | Source                                                     |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| `Amiri-Regular.ttf` | Arabic text (RTL) in PDF certificates           | https://github.com/alif-type/amiri/releases — OFL licensed |
| `DejaVuSans.ttf`    | Latin + Tifinagh (ZGH) text in PDF certificates | https://dejavu-fonts.github.io — free license              |

## Notes

- These files are excluded from git (binary assets — add to .gitignore if not already)
- Unit tests mock PDFKit entirely — fonts are NOT required to run tests
- Fonts ARE required for `GET /certifications/:id/certificate.pdf` at runtime
- For CI/CD: add font download step to Dockerfile or deployment pipeline
