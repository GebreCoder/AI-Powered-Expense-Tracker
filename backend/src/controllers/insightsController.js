const { getInsights, askInsights } = require("../services/insightsService");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUESTION_LENGTH = 500;

exports.getInsights = async (req, res, next) => {
  try {
    const { refresh, date } = req.query;
    if (date && !DATE_RE.test(date)) {
      return res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
    }
    const result = await getInsights(req.user.id, {
      refresh: refresh === "1" || refresh === "true",
      date: date || null,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.askInsights = async (req, res, next) => {
  try {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      return res
        .status(400)
        .json({ error: `Question must be ${MAX_QUESTION_LENGTH} characters or fewer` });
    }
    const result = await askInsights(req.user.id, question);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
