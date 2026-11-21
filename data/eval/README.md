# Extraction accuracy test set (PLAN.md G15)

This folder measures how well the AI pulls facts out of real adverts. **The correct answers must be filled in by a person**, never by the model.

## For the person labelling (about 5–10 minutes per advert)

1. Open a file in `labels/` (15 adverts from PSVC 42 that are not in the demo sample).
2. Read `advert_text`. The first part is the department section (closing date, how to apply), which applies to the post.
3. Fill in `expected`:
   - Copy values exactly as the advert says them. Dates as `YYYY-MM-DD`.
   - Use `null` when the advert does not state something. Don't guess.
   - `minimum_requirements` and `documents_required`: one list item per requirement or document.
   - Reference number without "(X2 POSTS)".
4. Set `labelled_by` to your name and `labelled_on` to today's date.

## Run the evaluation

```bash
services/ai/.venv/bin/python -I scripts/eval_extraction.py
```

Results go to `results.json` and appear at `/accuracy` in the app. Report the numbers as they are.

To recreate missing templates: `services/ai/.venv/bin/python -I scripts/make_eval_templates.py` (never overwrites labelled files).
