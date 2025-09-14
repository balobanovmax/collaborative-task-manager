import bcrypt from 'bcrypt';
const SALT_ROUNDS = 10;

// Hash a plain text password
export const hashPassword = async (plainPassword) => {
    try {
        const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
        return hashedPassword;
    } catch (error) {
        throw new Error('Password hashing failed');
    }
};

// Compare plain text password with hashed password
export const comparePassword = async (plainPassword, hashedPassword) => {
    try {
        const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
        return isMatch;
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};


