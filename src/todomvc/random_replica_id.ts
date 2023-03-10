const BASE64CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-";

/**
 * The default length of a replicaID, in characters.
 *
 * Rationale for value 10:
 * Each character of the replicaID gives us 6 bits of entropy,
 * for a total of 60 bits.  This gives a < 1%
 * probability that two replicas in the same conversation
 * will ever choose the same replicaID's, even if we
 * consider the total probability across 100,000,000
 * conversations with 10,000 replicaIDs each
 * (= 10 users * 1,000 days * 1 replica/user/day).
 */
export const DEFAULT_REPLICA_ID_LENGTH = 10;

/**
 * @return A random replicaID made of characters that may appear in
 * Firebase RTDB keys.
 * Such replicaID's can be safely treated as either
 * byte arrays or UTF-8 strings, and they are printable.
 */
export function randomReplicaID(
  length: number = DEFAULT_REPLICA_ID_LENGTH
): string {
  const arr = new Array<string>(length);
  let randomValues = new Uint8Array(length);
  // Use browser crypto library.
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    // Here we exploit the fact that 64 divides 256.
    // This would be biased otherwise.
    arr[i] = BASE64CHARS[randomValues[i] % 64];
  }
  return arr.join("");
}
