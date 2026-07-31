"use client";

import React, { useCallback, useEffect, useState } from "react";

import FeedbackQuestions from "./FeedbackQuestions";
import { apiErrorMessage } from "@/config/api";
import { getFeedbackQuestions } from "@/services/FeedbackService";

/**
 * The feedback question bank as the FEEDBACK FORM tab's panel — it renders
 * below the tiles like any other panel on the dashboard.
 */
export default function FeedbackFormPanel() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await getFeedbackQuestions());
    } catch (err) {
      setData([]);
      setError(apiErrorMessage(err, "Failed to fetch feedback questions"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  return (
    <FeedbackQuestions
      data={data}
      loading={loading}
      error={error}
      onRetry={fetchQuestions}
      onChanged={fetchQuestions}
    />
  );
}
