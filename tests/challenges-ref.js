function sumList(nums) {
  let t = 0;
  for (const n of nums) t += n;
  return t;
}

function maxOf(nums) {
  let b = nums[0];
  for (const n of nums) if (n > b) b = n;
  return b;
}

function countVowels(s) {
  let n = 0;
  for (const ch of s.toLowerCase()) if ("aeiou".includes(ch)) n++;
  return n;
}

function reverseString(s) {
  let o = "";
  for (const ch of s) o = ch + o;
  return o;
}

function isPalindrome(s) {
  let i = 0, j = s.length - 1;
  while (i < j) { if (s[i] !== s[j]) return false; i++; j--; }
  return true;
}

function fizzbuzz(n) {
  const o = [];
  for (let i = 1; i <= n; i++) o.push(i % 15 === 0 ? "FizzBuzz" : i % 3 === 0 ? "Fizz" : i % 5 === 0 ? "Buzz" : String(i));
  return o;
}

function factorial(n) {
  let p = 1;
  for (let i = 2; i <= n; i++) p *= i;
  return p;
}

function fibonacci(n) {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}

function isPrime(n) {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

function countWords(s) {
  return s.split(" ").filter((w) => w !== "").length;
}

function removeDuplicates(nums) {
  const o = [];
  for (const n of nums) if (!o.includes(n)) o.push(n);
  return o;
}

function secondLargest(nums) {
  let a = null, b = null;
  for (const n of nums) { if (a === null || n > a) { if (a !== null) b = a; a = n; } else if (n !== a && (b === null || n > b)) b = n; }
  return b;
}

function capitalizeWords(s) {
  return s.split(" ").map((w) => w.slice(0, 1).toUpperCase() + w.slice(1)).join(" ");
}

function twoSum(nums, target) {
  for (let j = 0; j < nums.length; j++) for (let i = 0; i < j; i++) if (nums[i] + nums[j] === target) return [i, j];
  return [];
}

function isAnagram(a, b) {
  return [...a].sort().join("") === [...b].sort().join("");
}

function flatten(lists) {
  const o = [];
  for (const inner of lists) for (const x of inner) o.push(x);
  return o;
}

function runningSum(nums) {
  const o = []; let t = 0;
  for (const n of nums) { t += n; o.push(t); }
  return o;
}

function gcd(a, b) {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function binaryToInt(s) {
  let n = 0;
  for (const ch of s) n = n * 2 + (ch === "1" ? 1 : 0);
  return n;
}

function chunk(nums, size) {
  const o = [];
  for (let i = 0; i < nums.length; i += size) o.push(nums.slice(i, i + size));
  return o;
}

function validBrackets(s) {
  const pairs = { ")": "(", "]": "[", "}": "{" }; const st = [];
  for (const ch of s) { if ("([{".includes(ch)) st.push(ch); else if (")]}".includes(ch)) { if (!st.length || st.pop() !== pairs[ch]) return false; } }
  return st.length === 0;
}

function rotateLeft(nums, k) {
  if (!nums.length) return [];
  k = k % nums.length;
  return nums.slice(k).concat(nums.slice(0, k));
}

function mergeSorted(a, b) {
  const o = []; let i = 0, j = 0;
  while (i < a.length && j < b.length) o.push(a[i] <= b[j] ? a[i++] : b[j++]);
  return o.concat(a.slice(i), b.slice(j));
}

function mostCommonChar(s) {
  const c = {};
  for (const ch of s) c[ch] = (c[ch] || 0) + 1;
  let best = s[0];
  for (const ch of s) if (c[ch] > c[best]) best = ch;
  return best;
}
