def sum_list(nums):
    total = 0
    for n in nums:
        total += n
    return total

def max_of(nums):
    best = nums[0]
    for n in nums:
        if n > best:
            best = n
    return best

def count_vowels(s):
    n = 0
    for ch in s.lower():
        if ch in "aeiou":
            n += 1
    return n

def reverse_string(s):
    out = ""
    for ch in s:
        out = ch + out
    return out

def is_palindrome(s):
    i = 0
    j = len(s) - 1
    while i < j:
        if s[i] != s[j]:
            return False
        i += 1
        j -= 1
    return True

def fizzbuzz(n):
    out = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            out.append("FizzBuzz")
        elif i % 3 == 0:
            out.append("Fizz")
        elif i % 5 == 0:
            out.append("Buzz")
        else:
            out.append(str(i))
    return out

def factorial(n):
    p = 1
    for i in range(2, n + 1):
        p *= i
    return p

def fibonacci(n):
    a = 0
    b = 1
    for _ in range(n):
        a, b = b, a + b
    return a

def is_prime(n):
    if n < 2:
        return False
    d = 2
    while d * d <= n:
        if n % d == 0:
            return False
        d += 1
    return True

def count_words(s):
    n = 0
    for w in s.split(" "):
        if w != "":
            n += 1
    return n

def remove_duplicates(nums):
    seen = []
    for n in nums:
        if n not in seen:
            seen.append(n)
    return seen

def second_largest(nums):
    a = None
    b = None
    for n in nums:
        if a is None or n > a:
            if a is not None:
                b = a
            a = n
        elif n != a and (b is None or n > b):
            b = n
    return b

def capitalize_words(s):
    out = []
    for w in s.split(" "):
        out.append(w[:1].upper() + w[1:])
    return " ".join(out)

def two_sum(nums, target):
    for j in range(len(nums)):
        for i in range(j):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []

def is_anagram(a, b):
    return sorted(a) == sorted(b)

def flatten(lists):
    out = []
    for inner in lists:
        for x in inner:
            out.append(x)
    return out

def running_sum(nums):
    out = []
    t = 0
    for n in nums:
        t += n
        out.append(t)
    return out

def gcd(a, b):
    while b != 0:
        a, b = b, a % b
    return a

def binary_to_int(s):
    n = 0
    for ch in s:
        n = n * 2 + (1 if ch == "1" else 0)
    return n

def chunk(nums, size):
    out = []
    i = 0
    while i < len(nums):
        out.append(nums[i:i + size])
        i += size
    return out

def valid_brackets(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in "([{":
            stack.append(ch)
        elif ch in ")]}":
            if len(stack) == 0 or stack.pop() != pairs[ch]:
                return False
    return len(stack) == 0

def rotate_left(nums, k):
    if len(nums) == 0:
        return []
    k = k % len(nums)
    return nums[k:] + nums[:k]

def merge_sorted(a, b):
    out = []
    i = 0
    j = 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            out.append(a[i])
            i += 1
        else:
            out.append(b[j])
            j += 1
    return out + a[i:] + b[j:]

def most_common_char(s):
    counts = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    best = s[0]
    for ch in s:
        if counts[ch] > counts[best]:
            best = ch
    return best
