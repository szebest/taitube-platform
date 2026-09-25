import { type FlowJobNode, FlowProducerPort, type QueueJob } from '@vp/core/ports';
import { type QueueUnavailable, queueUnavailable } from '@vp/errors';
import { type Result, err, ok } from '@vp/result';
import type { InMemoryJobQueue } from './in-memory-job-queue';

/** `undefined` for a queue this producer cannot run: a flow naming one is refused, not parked. */
export type InMemoryQueueLookup = (name: string) => InMemoryJobQueue | undefined;

interface ChildPlan {
  node: FlowJobNode;
  queue: InMemoryJobQueue;
  jobId: string;
}

interface ParentState {
  queue: InMemoryJobQueue;
  job: QueueJob<unknown>;
  pending: number;
  failed: boolean;
  childrenValues: Record<string, unknown>;
}

export class InMemoryFlowProducer extends FlowProducerPort {
  private isHealthy = true;

  constructor(private readonly queueNamed: InMemoryQueueLookup) {
    super();
  }

  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy;
  }

  async checkHealth(): Promise<Result<void, QueueUnavailable>> {
    return this.isHealthy ? ok() : err(queueUnavailable('checkHealth'));
  }

  async add<T = unknown>(node: FlowJobNode<T>): Promise<Result<unknown, QueueUnavailable>> {
    const parentQueue = this.queueNamed(node.queueName);
    if (!parentQueue) return err(queueUnavailable('add', `no in-memory queue ${node.queueName}`));

    const plans: ChildPlan[] = [];
    for (const child of node.children ?? []) {
      const queue = this.queueNamed(child.queueName);
      if (!queue) return err(queueUnavailable('add', `no in-memory queue ${child.queueName}`));
      const jobId = child.opts?.jobId ?? `child-${Date.now()}-${child.name}`;
      plans.push({ node: child, queue, jobId });
    }

    const added = await parentQueue.add(node.name, node.data, {
      ...node.opts,
      jobId: node.opts?.jobId ?? `parent-${Date.now()}`,
      initialState: plans.length > 0 ? 'waiting-children' : 'waiting',
    });
    if (!added.ok) return added;

    const parent: ParentState = {
      queue: parentQueue,
      job: added.value,
      pending: plans.length,
      failed: false,
      childrenValues: {},
    };
    parent.job.getChildrenValues = async <R = Record<string, unknown>>() =>
      parent.childrenValues as R;

    const childJobs: QueueJob<unknown>[] = [];
    for (const plan of plans) {
      this.watchChild(parent, plan);
      const childJob = await plan.queue.add(plan.node.name, plan.node.data, {
        ...plan.node.opts,
        jobId: plan.jobId,
      });
      if (!childJob.ok) return childJob;
      childJobs.push(childJob.value);
    }

    return ok({ job: parent.job, children: childJobs });
  }

  async close(): Promise<Result<void, QueueUnavailable>> {
    return ok();
  }

  private watchChild(parent: ParentState, plan: ChildPlan): void {
    plan.queue.onJobCompleted((job, result) => {
      if (job.id !== plan.jobId) return;
      parent.childrenValues[plan.node.name] = result;
      parent.childrenValues[job.id] = result;
      parent.childrenValues[`bull:${plan.node.queueName}:${job.id}`] = result;
      this.settleChild(parent);
    });

    plan.queue.onJobFailed((job, error) => {
      if (job.id !== plan.jobId || parent.failed) return;
      if (plan.node.opts?.failParentOnFailure) {
        parent.failed = true;
        parent.queue.failJob(parent.job.id, error).catch(() => {});
        return;
      }
      if (plan.node.opts?.ignoreDependencyOnFailure) this.settleChild(parent);
    });
  }

  /** The last child to settle moves the parent from waiting-children to waiting and runs it. */
  private settleChild(parent: ParentState): void {
    parent.pending -= 1;
    if (parent.pending > 0 || parent.failed) return;
    parent.queue.enqueueWaiting(parent.job);
    parent.queue.executeJob(parent.job).catch(() => {});
  }
}
