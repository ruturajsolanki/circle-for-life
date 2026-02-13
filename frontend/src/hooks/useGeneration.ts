/**
 * Circle for Life - Generation Job Hook
 * Polling for image generation status
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiClient } from '../config/api';

export type GenerationModel = 'sdxl-turbo' | 'flux' | 'midjourney';

export interface GenerationJob {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  thumbnailUrl?: string;
  blurhash?: string;
  generationTimeMs?: number;
  estimatedWaitMs?: number;
  error?: string;
}

export interface CreateGenerationParams {
  prompt: string;
  refinedPrompt?: string;
  model: GenerationModel;
  params?: {
    steps?: number;
    cfgScale?: number;
    negativePrompt?: string;
  };
}

export interface CreateGenerationResponse {
  jobId: string;
  status: 'queued';
  estimatedWaitMs?: number;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 180; // ~6 minutes at 2s interval

export const useGeneration = (jobId: string | null) => {
  const queryClient = useQueryClient();

  const jobQuery = useQuery({
    queryKey: ['generation', jobId],
    queryFn: async () => {
      const { data } = await apiClient.get<GenerationJob>(`/generations/${jobId}`);
      return data;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return POLL_INTERVAL_MS;
      if (data.status === 'completed' || data.status === 'failed') {
        return false; // Stop polling
      }
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: true,
  });

  const createMutation = useMutation({
    mutationFn: async (params: CreateGenerationParams) => {
      const { data } = await apiClient.post<CreateGenerationResponse>(
        '/generations/create',
        params
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['generation', data.jobId], {
        jobId: data.jobId,
        status: data.status,
        estimatedWaitMs: data.estimatedWaitMs,
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<CreateGenerationResponse>(
        `/generations/${id}/retry`
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['generation', data.jobId], {
        jobId: data.jobId,
        status: data.status,
      });
    },
  });

  const isComplete = jobQuery.data?.status === 'completed';
  const isFailed = jobQuery.data?.status === 'failed';
  const isProcessing =
    jobQuery.data?.status === 'queued' || jobQuery.data?.status === 'processing';

  const reset = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['generation', jobId] });
  }, [queryClient, jobId]);

  return {
    job: jobQuery.data,
    isLoading: jobQuery.isLoading,
    isComplete,
    isFailed,
    isProcessing,
    error: jobQuery.error,
    createGeneration: createMutation.mutateAsync,
    retryGeneration: retryMutation.mutateAsync,
    refetch: jobQuery.refetch,
    reset,
  };
};
