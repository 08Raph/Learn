# Academic audit of the University curriculum (v4.0)

**Method.** The catalogue (52 courses, 255 lessons) was compared, area by area, with the published shape of
undergraduate and master's computer-science and software-engineering programmes: the ACM/IEEE computing
curricula knowledge areas, and the public course lists of MIT (6.006, 6.042, 6.046, 6.004, 6.824, 18.06),
Stanford (CS106, CS161, CS229), Carnegie Mellon (15-213, 15-445) and Harvard (CS50). The comparison is of
**topics and outcomes**. It is the judgement of the author of this content, not an external accreditation
review, and no claim of equivalence to any institution is made. Depth here is that of a guided self-study
text: each topic is introduced properly with examples, exercises and assessment, but a university course
spends ten to fourteen weeks on what one course here covers in five or six lessons.

| Area | Where it is taught | Verdict | Gaps |
|---|---|---|---|
| Programming fundamentals | SEU 101–108 | Strong | — |
| Data structures and algorithms | 202, 203, 301, 504 | Strong; proofs of correctness, amortised analysis, flow, DP, approximation | Computational geometry, advanced string structures in depth |
| Discrete mathematics | 501 | Good: logic, proof, induction, counting, graphs, number theory | Generating functions; formal probability belongs to 502 |
| Calculus and linear algebra | 502 (lessons 4–6); **new electives MAT 101 and MAT 102** | Improved: each subject now has its own four-lesson course with a tested lab, examination and project | Still introductions. A university gives each a full semester with proofs and problem sets; vector spaces, multivariable integration and proofs are outlined only |
| Probability and statistics | 502 (lessons 1–3) | Adequate for ML and experiments | Continuous distributions and estimation theory in depth |
| Complexity and computability | 503 | Good: automata, undecidability proof, NP-completeness | Space complexity, randomised classes only named |
| Programming languages, compilers | 406, 508 | Good: lexing to code generation, semantics, type soundness | No full compiler back end is built |
| Computer architecture and engineering | 505, CEN 101, **CEN 102, CEN 103** | Good: gates to CPU, embedded systems with basic electronics, memory, storage, buses and drivers | No hardware description language, analogue design or lab hardware; labs compute and simulate only |
| Operating systems | 307, 505 | Adequate | Scheduling, file systems and virtualisation in less depth than 15-213 / OSTEP |
| Networking | 306 | Adequate | Routing protocols and congestion control are brief |
| Databases | 205, 305, 506 | Strong: SQL to transactions, recovery, distributed SQL | Query-engine implementation is a project, not taught step by step |
| Software engineering and architecture | 207, 302, 303, 308, 403, 409, 601 | Strong | — |
| Distributed systems | 401, 402, 607 | Strong: clocks, replication, consensus, sagas, failure testing | Byzantine fault tolerance only described |
| Cybersecurity | 304, 407, 509, 602 | Good, defender-focused | Offensive techniques deliberately not taught as skills |
| Cloud computing | 308, 408, 602 | Good; simulated, no real cloud account needed | Provider-specific services |
| AI, ML, deep learning | 507, 605 | Good introduction with derivations and from-scratch labs | Computer vision, NLP and RL are each a full course elsewhere |
| Formal methods and verification | 508 | Good: Hoare logic, model checking, a checker built in the lab | No proof-assistant practice |
| Research methodology | 510, 608 | Strong | — |
| Professional engineering | 603, 604 | Strong | — |
| Computer graphics | **GDV 102** | New: rasterisation, transformations, the 3D pipeline, lighting; a software-renderer project | No GPU or shader practice; ray tracing described only |
| Game development | GDV 101, **GDV 102, GDV 103** | Adequate introduction: loop, graphics, AI, pathfinding, physics response, animation, optimisation | No commercial engine, audio, multiplayer networking or game design |
| Human-computer interaction | **HCI 101** | New: principles, human factors with Fitts and Hick, design process, accessibility, evaluation, ethics | A four-lesson introduction; no supervised user studies |
| Numerical methods | **NUM 101** | New: floating point, roots, differentiation and integration, linear systems, ODEs | Interpolation, optimisation and eigenvalue algorithms not covered |
| Mobile development | MOB 101, **MOB 102, MOB 103** | Adequate conceptual coverage of both platforms, architecture, data, networking, security and release | Graded labs are platform-independent logic in JavaScript; no native app is built or run on this site |
| Not covered | — | — | Natural-language processing, computer vision, signal processing, hardware description languages, bioinformatics as subjects in their own right |

## Changes made in 4.0
- **Ten new electives** in the thin departments and the named gaps (see the table). Each has four
  substantive lessons with knowledge checks, a tested programming assignment, an examination of six
  multiple-choice questions and a written question with a rubric, and a project with requirements,
  deliverables and a rubric. Every reference solution passes and every starter fails in the real grader.
- **Honest size.** These are four-lesson introductions of roughly six study hours each, not semester
  courses. Department pages say so. They do not count toward the 52 courses, the six stages or graduation.
- **Practical work:** algorithm visualiser and a practice studio of 27 exercises across six skills.
- **Projects and capstones:** every project page now shows objectives, five milestones built from its own
  requirements, submission guidance and exact completion criteria.
- **Assessment clarity:** testing out of a stage (passing its final early) is now explained as unlocking,
  not completing.

## Changes made in 3.1 because of the audit
- **Mathematical depth:** SEU 501 now solves recurrences three ways (recursion tree, induction, master
  theorem with Karatsuba and Strassen as worked cases). SEU 507 now includes a fully numeric worked
  backpropagation step and the matrix form of the backward pass.
- **Worked derivations on demand:** the professor has eight step-by-step derivations (series sums,
  recurrences, gradient of the squared error, Bayes with numbers, entropy, Amdahl).
- **Capstones:** each of the three now has five milestones with the share of time and the evidence that
  marks each as done, and an explicit statement of how it is evaluated.
- **New disciplines:** three elective courses with tested assignments (Game Programming Foundations,
  Digital Logic and How a CPU Executes, Mobile Application Foundations).
- **Honest scope:** every department page states what it does not cover.

## What was deliberately not done
- No lessons were added to raise the count. Stage structure, prerequisites, pass marks and the 52 courses
  and 255 lessons of the core programme are unchanged.
- (3.1) Calculus and linear algebra were not split out. In 4.0 they are separate four-lesson electives;
  full 12-lesson courses with proofs and problem sets remain the most valuable next addition.
