import { Topic } from '../types';

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Flat structure representation for easier clustering
interface FlatTopic {
  originalTopic: Topic;
  parentRef: Topic | null;
  embedding: number[];
}

export function groupTopicsSemantically(rootTopics: Topic[], embeddingsFlatList: number[]): Topic[] {
  // We need to match the flat list of embeddings back to the recursive tree structure.
  // First, we flatten the tree to align with embeddings.
  
  const flatTopics: FlatTopic[] = [];
  let index = 0;
  
  function traverse(topic: Topic, parent: Topic | null) {
    flatTopics.push({
      originalTopic: topic,
      parentRef: parent,
      embedding: embeddingsFlatList[index++]
    });
    topic.children.forEach(child => traverse(child, topic));
  }
  
  rootTopics.forEach(root => traverse(root, null));

  // Now, we identify adjacent/sibling nodes that are semantically identical (similarity > 0.85)
  // We will do a bottom-up pass, or just a sibling-level pass.
  
  function clusterSiblings(siblings: Topic[]) {
    if (siblings.length <= 1) return siblings;

    const mergedSiblings: Topic[] = [];
    let currentCluster: Topic[] = [];

    for (let i = 0; i < siblings.length; i++) {
      const topic = siblings[i];
      if (currentCluster.length === 0) {
        currentCluster.push(topic);
        continue;
      }

      // Check similarity with the last topic in the cluster
      const prevTopic = currentCluster[currentCluster.length - 1];
      const prevFlat = flatTopics.find(f => f.originalTopic.id === prevTopic.id);
      const currFlat = flatTopics.find(f => f.originalTopic.id === topic.id);

      if (prevFlat && currFlat) {
        const sim = cosineSimilarity(prevFlat.embedding, currFlat.embedding);
        if (sim > 0.85) {
          // Merge: add to current cluster
          currentCluster.push(topic);
        } else {
          // Commit current cluster and start new one
          mergedSiblings.push(mergeCluster(currentCluster));
          currentCluster = [topic];
        }
      } else {
        mergedSiblings.push(mergeCluster(currentCluster));
        currentCluster = [topic];
      }
    }

    if (currentCluster.length > 0) {
      mergedSiblings.push(mergeCluster(currentCluster));
    }

    // Recursively cluster children of the merged nodes
    mergedSiblings.forEach(node => {
      node.children = clusterSiblings(node.children);
    });

    return mergedSiblings;
  }

  function mergeCluster(cluster: Topic[]): Topic {
    if (cluster.length === 1) return cluster[0];

    // Pick the shortest, most concise title for the merged node
    const bestTitleTopic = [...cluster].sort((a, b) => a.title.length - b.title.length)[0];
    
    // Combine children and calculate average embedding
    const combinedChildren: Topic[] = [];
    let avgEmbedding: number[] = new Array(384).fill(0);
    let count = 0;

    cluster.forEach(t => {
      combinedChildren.push(...t.children);
      const flatTopic = flatTopics.find(f => f.originalTopic.id === t.id);
      if (flatTopic && flatTopic.embedding) {
         for(let i = 0; i < 384; i++) {
            avgEmbedding[i] += flatTopic.embedding[i];
         }
         count++;
      }
    });

    if (count > 0) {
       for(let i = 0; i < 384; i++) {
          avgEmbedding[i] /= count;
       }
    }

    return {
      id: cluster[0].id, // keep original ID of the first node
      title: bestTitleTopic.title,
      level: cluster[0].level,
      startPage: Math.min(...cluster.map(t => t.startPage)),
      endPage: Math.max(...cluster.map(t => t.endPage || t.startPage)),
      embedding: count > 0 ? avgEmbedding : undefined,
      children: combinedChildren
    };
  }

  return clusterSiblings(rootTopics);
}

// Utility to extract titles cleanly for embedding
export function extractTitlesForEmbedding(rootTopics: Topic[]): string[] {
  const titles: string[] = [];
  function traverse(topic: Topic) {
    titles.push(topic.title);
    topic.children.forEach(traverse);
  }
  rootTopics.forEach(traverse);
  return titles;
}
