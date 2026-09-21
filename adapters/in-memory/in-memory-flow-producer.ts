import { type FlowJobNode, FlowProducerPort, type JobQueue, type QueueJob } from '@vp/core/ports';
import { InMemoryJobQueue } from './in-memory-job-queue';

export class InMemoryFlowProducer extends FlowProducerPort {
  private readonly getQueue: (name: string) => JobQueue;
  private isHealthy = true;

  constructor(getQueue: (name: string) => JobQueue) {
    super();
    this.getQueue = getQueue;
  }

  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy;
  }

  async checkHealth(): Promise<boolean> {
    return this.isHealthy;
  }

  async add<T = unknown>(node: FlowJobNode<T>): Promise<unknown> {
    const parentQueue = this.getQueue(node.queueName);
    const parentJobId = node.opts?.jobId ?? `parent-${Date.now()}`;

    const children = node.children ?? [];
    const childrenValues: Record<string, unknown> = {};
    let pendingChildrenCount = children.length;
    let parentFailed = false;

    // 1. Add parent in 'waiting-children' state if children exist, or 'waiting' if no children
    const initialState = children.length > 0 ? 'waiting-children' : 'waiting';
    const parentJob =
      parentQueue instanceof InMemoryJobQueue
        ? await parentQueue.add(node.name, node.data, {
            ...node.opts,
            jobId: parentJobId,
            initialState,
          })
        : await parentQueue.add(node.name, node.data, {
            ...node.opts,
            jobId: parentJobId,
          });

    // Provide getChildrenValues to parent
    parentJob.getChildrenValues = async <R = Record<string, unknown>>() =>
      childrenValues as R;

    if (children.length === 0) {
      return { job: parentJob, children: [] };
    }

    // 2. Add each child and hook into completion / failure
    const childJobs: QueueJob<unknown>[] = [];

    for (const childNode of children) {
      const childQueue = this.getQueue(childNode.queueName);
      const childJobId = childNode.opts?.jobId ?? `child-${Date.now()}-${childNode.name}`;

      if (childQueue instanceof InMemoryJobQueue) {
        childQueue.onJobCompleted((job, result) => {
          if (job.id === childJobId) {
            childrenValues[childNode.name] = result;
            childrenValues[job.id] = result;
            if (childNode.queueName) {
              childrenValues[`bull:${childNode.queueName}:${job.id}`] = result;
            }
            pendingChildrenCount--;
            if (pendingChildrenCount === 0 && !parentFailed) {
              // All children complete: transition parent from waiting-children to waiting
              if (parentQueue instanceof InMemoryJobQueue) {
                parentQueue.enqueueWaiting(parentJob);
                parentQueue.executeJob(parentJob).catch(() => {});
              }
            }
          }
        });

        childQueue.onJobFailed((job, err) => {
          if (job.id === childJobId) {
            if (childNode.opts?.failParentOnFailure && !parentFailed) {
              parentFailed = true;
              if (parentQueue instanceof InMemoryJobQueue) {
                parentQueue.failJob(parentJob.id, err).catch(() => {});
              }
            } else if (childNode.opts?.ignoreDependencyOnFailure) {
              pendingChildrenCount--;
              if (pendingChildrenCount === 0 && !parentFailed) {
                if (parentQueue instanceof InMemoryJobQueue) {
                  parentQueue.enqueueWaiting(parentJob);
                  parentQueue.executeJob(parentJob).catch(() => {});
                }
              }
            }
          }
        });
      }

      const childJob = await childQueue.add(childNode.name, childNode.data, {
        ...childNode.opts,
        jobId: childJobId,
      });

      childJobs.push(childJob);
    }

    return { job: parentJob, children: childJobs };
  }

  async close(): Promise<void> {}
}
