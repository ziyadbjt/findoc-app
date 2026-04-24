from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

hash = '$2b$12$qJpGEgvdiyewKNOxzrSMbOJJasbagASZjSMOPogGx2RnC0qlGrU0G'

passwords = ['password', 'password123', '123456', 'admin', 'ziyad']

for p in passwords:
    if pwd_context.verify(p, hash):
        print(f'Password is {p}')
        break
else:
    print('Password not found')