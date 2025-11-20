# Private Habit Tracker

Private Habit Tracker is a privacy-preserving application that empowers users to record and analyze their private habits without compromising their personal data. Utilizing Zama's Fully Homomorphic Encryption (FHE) technology, this project enables secure data storage and insightful analysis powered by artificial intelligence, ensuring that your sensitive information remains confidential and protected.

## The Problem

In today's world, personal data is more vulnerable than ever. Individuals often share their habits, behaviors, and preferences with various applications, exposing themselves to potential risks such as data breaches, unauthorized access, and misuse of their information. Traditional habit tracking applications store data in cleartext, which can be exploited by third parties. This lack of data privacy can discourage users from engaging fully in self-improvement activities, limiting their potential for personal growth. 

## The Zama FHE Solution

Fully Homomorphic Encryption (FHE) presents a groundbreaking approach to solving the privacy dilemma inherent in habit tracking. With FHE, computations can be performed on encrypted data, allowing private information to stay secure while still enabling valuable insights to be drawn from the data. By leveraging Zama's advanced libraries, such as fhevm, we can ensure that users can receive personalized suggestions based on their encrypted habit data without ever exposing it in cleartext. 

Using fhevm to process encrypted inputs, our application is able to securely analyze trends and provide actionable advice without risking user privacy.

## Key Features

- 🔒 **Privacy First**: All habit data is encrypted, ensuring that user information is never exposed.
- 🤖 **AI-Powered Insights**: The application utilizes homomorphic analysis to provide personalized recommendations and track trends in users' habits.
- 📊 **Statistical Breakdown**: Users can view statistical graphs and trends derived from their encrypted data without compromising privacy.
- 📆 **Daily Check-Ins**: Users can record their habits daily, building a comprehensive view of their lifestyle without worrying about data leaks.
- 📈 **Self-Improvement Tracker**: Analyze progress over time to foster personal growth and improvement.
  
## Technical Architecture & Stack

The Private Habit Tracker is built on a robust technical foundation, utilizing the following technologies:

- **Core Privacy Engine**: Zama's FHE libraries (fhevm)
- **Front-End**: React, JavaScript
- **Back-End**: Node.js, Express
- **Database**: Encrypted storage solutions
- **AI Framework**: Concrete ML for backend analysis

## Smart Contract / Core Logic

Here is a simplified, illustrative example of how the application might leverage FHE capabilities:

```solidity
// solidity code for habit tracking
pragma solidity ^0.8.0;

import "TFHE.sol";

contract PrivateHabitTracker {
    struct Habit {
        uint64 encryptedData;
        uint64 timestamp;
    }

    mapping(address => Habit) public habits;

    function recordHabit(uint64 encryptedHabitData) public {
        habits[msg.sender] = Habit(encryptedHabitData, block.timestamp);
    }

    function analyzeHabit(address user) public view returns (uint64) {
        return TFHE.decrypt(habits[user].encryptedData);
    }
}
```

The above Solidity smart contract demonstrates how encrypted habit data can be recorded and later analyzed securely.

## Directory Structure

```
PrivateHabitTracker/
├── contracts/
│   └── PrivateHabitTracker.sol
├── src/
│   ├── App.js
│   ├── HabitTracker.js
│   └── api.js
├── scripts/
│   └── analysis.py
└── package.json
```

## Installation & Setup

### Prerequisites

Before you begin, ensure that you have the following installed:

- Node.js and npm for the front-end
- Python and pip for the back-end analysis

### Dependencies

To set up the project, install the necessary libraries:

1. Navigate to the project directory.
2. Install the necessary npm packages:

```bash
npm install
npm install fhevm
```

3. Install the required Python packages:

```bash
pip install concrete-ml
```

## Build & Run

To build and run the Private Habit Tracker application, follow these commands:

1. **Compile the smart contracts:**

```bash
npx hardhat compile
```

2. **Start the application:**

```bash
npm start
```

3. **Run the analysis script:**

```bash
python main.py
```

This will initiate the server and allow users to interact with the application through their web browser, as well as conduct the analysis on their encrypted habit data.

## Acknowledgements

We would like to express our gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their commitment to advancing privacy-preserving technologies has been instrumental in the development of the Private Habit Tracker.

---

By following this README, you can successfully set up and run the Private Habit Tracker, utilizing Zama’s FHE technology to securely track and analyze your personal habits. Join us in promoting a privacy-first approach to personal development!

