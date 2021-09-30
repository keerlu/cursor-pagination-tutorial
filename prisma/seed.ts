import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const alice = await prisma.user.upsert({
    where: { email: 'alice@prisma.io' },
    update: {},
    create: {
      email: 'alice@prisma.io',
      name: 'Alice',
      posts: {
        create: [
          {
            id: 2,
            title: 'First post by Alice',
            content: 'Hello world!',
          },
          {
            id: 5,
            title: 'Update from Alice',
            content: 'Some recent news',
          },
          {
            id: 6,
            title: 'Another post by Alice',
            content: 'Another update',
          },
        ],
      },
    },
  })

  const bob = await prisma.user.upsert({
    where: { email: 'bob@prisma.io' },
    update: {},
    create: {
      email: 'bob@prisma.io',
      name: 'Bob',
      posts: {
        create: [
          {
            id: 9,
            title: 'First post by Bob',
            content: 'This is my first post!',
          },
          {
            id: 14,
            title: 'Update from Bob',
            content: 'What I\'ve been working on',
          },
        ],
      },
    },
  })

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@prisma.io' },
    update: {},
    create: {
      email: 'charlie@prisma.io',
      name: 'Charlie',
      posts: {
        create: [
          {
            id: 16,
            title: 'First post by Charlie',
            content: 'Hi everyone!',
          },
          {
            id: 17,
            title: 'Update from Charlie',
            content: 'Lots of news',
          },
        ],
      },
    },
  })

  console.log({ alice, bob, charlie })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

