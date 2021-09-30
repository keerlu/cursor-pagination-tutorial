# Tutorial: Cursor-based pagination in GraphQL

Pagination is a method of splitting a list of data into smaller chunks, like pages in a book. This often useful in API requests where the full list would be slow to return, or unwieldy to display all at once. For example, a feed of all blog posts on a site is often split into multiple pages.

One common approach to implementing this is **cursor-based pagination**. In this tutorial, you will learn how cursor-based pagination works and implement an example using the following stack:

- [**SQLite**](https://www.sqlite.org/index.html): a file-based local SQL database
- [**Prisma Migrate**](https://www.prisma.io/docs/concepts/components/prisma-migrate): a database migration tool which you'll use for seeding the database with example data
- [**Prisma Client**](https://www.prisma.io/docs/concepts/components/prisma-client): a database client for TypeScript and Node.js                 
- [**GraphQL Nexus**](https://nexusjs.org/docs/): a GraphQL schema definition and resolver implementation 
- [**Apollo Server**](https://github.com/apollographql/apollo-server): an HTTP server for GraphQL APIs with an inbuilt sandbox for testing queries   

**Note:** You will need [Node.js](https://nodejs.org) (version 12.6 or higher) for this tutorial.

## Contents

- [What is cursor-based pagination?](#what-is-cursor-based-pagination)
- [Example project: getting started](#example-project-getting-started)
- [Example project: GraphQL queries](#example-project-graphql-queries)

## What is cursor-based pagination?

To understand the advantages of cursor-based pagination, it will be useful to first compare it to another common method, **offset pagination**, which returns a set of elements with a given offset from the start of the list. Offset pagination in Prisma uses the following parameters:
- `skip`: the number of elements of the list to skip 
- `take`: the number of elements of the list to return

For example, the following diagram `skip`s the first 2 posts and `take`s the next 3:

![Offset pagination example](./images/offset-pagination.svg)

Offset pagination is useful because it allows selection of data at any point in the list. However, offset pagination also has disadvantages:
- It scales poorly. Offsetting relies on an underlying `OFFSET` feature in the SQL database which has to traverse all the skipped records before returning the ones requested. This leads to slow performance on large datasets.
- It can lead to skipped data if the list is still being actively modified. For example, say someone else deletes the third post in the diagram above while you are viewing the page, and then you select to view the next page with `skip:2 take:5`. The sixth page of the original list will be missed out. 
 
Cursor-based pagination instead uses a **cursor** to keep track of the current place in the list. Cursor-based pagination in Prisma uses an extra parameter:

- `cursor`: a unique id corresponding to the last element of the list returned

With cursor-based pagination, you first access the first page of the list with `skip` and `take`:

![Cursor-based pagination example: accessing the first page](./images/cursor-pagination-1.svg)

To get the second page, you take a unique `id` from the last element of the first page, and use this as your cursor value (`cursor: 6` in this case). You then need to `skip: 1` to start from the *next* element of the list:

![Cursor-based pagination example: accessing the second page](./images/cursor-pagination-2.svg)

Cursor-based pagination doesn't require traversing the whole list of records in the database, so it scales much better. However, you do have to start from the beginning of the list.

## Example project: getting started

In this section you'll get the example project set up with all the required dependencies and some initial test data.

### 1. Initialise the project directory

As a first step, create a project directory and navigate into it:

```
mkdir cursor-pagination-tutorial 
cd cursor-pagination-tutorial
```

Next, initialize a new project:

```
npm init -y 
```

This creates a `package.json` file with a basic initial setup for your TypeScript app. Add the following to this file: 

```json
"dependencies": {
  "@prisma/client": "3.1.1",
  "apollo-server": "3.3.0",
  "graphql": "15.6.0",
  "nexus": "1.1.0"
},
"devDependencies": {
  "@types/node": "14.17.19",
  "prisma": "3.1.1",
  "ts-node": "10.2.1",
  "ts-node-dev": "1.1.8",
  "typescript": "4.4.3"
}
```
 Now run:
 
 ```
 npm install
 ```
 
This will install the required dependencies.
 
TypeScript also requires a `tsconfig.json` configuration file in the root directory of the project. Create this and add the following:

```json
{
  "compilerOptions": {
    "sourceMap": true,
    "outDir": "dist",
    "strict": true,
    "lib": ["esnext"],
    "esModuleInterop": true
  }
}
```

### 2. Create a Prisma schema

First run the following command to initialise a new Prisma schema file:

```
npx prisma init --datasource-provider sqlite
```

Add the following Prisma data model to the newly-created file in `prisma/schema.prisma`:

```
model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String?
  published Boolean @default(false)
  author    User?   @relation(fields: [authorId], references: [id])
  authorId  Int?
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]
}
```

Now use Prisma Migrate to map this data model to the database schema:

```
npx prisma migrate dev --name init
```

### 3. Seed the database with example data

Create a new file named `prisma/seed.ts` and copy in the [example seed file from this Github repository]() 
!! link to file in repository

!!

!!

Add a reference to this in the `package.json` file:

```json
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
```

You can now run:

```
npx prisma db seed
```

## Example project: Set up Nexus and Apollo Server

### 1. Add a context file

Add the following to a new `context.ts` file:

```ts
import { PrismaClient } from '@prisma/client'

export interface Context {
  prisma: PrismaClient
}

const prisma = new PrismaClient()

export const context: Context = {
  prisma: prisma,
}
```

Nexus will need this context for its resolvers, which fetch the required data from the Prisma data source.

### 2. Add a server file

This file has the code for initialising and running an Apollo Server instance. Create a new `server.ts` file and add the following:

```ts
import { ApolloServer } from 'apollo-server'
import { schema } from './schema'
import { context } from './context'

const server = new ApolloServer({
  schema: schema,
  context: context,
})

server.listen().then(async ({ url }) => {
  console.log(`\
  Server ready at: ${url}
  `)
})
```

### 3. Add a Nexus schema file

This file defines the GraphQL schema. First add the following imports to a new `schema.ts` file:

```ts
import { Context } from './context'
import {
    intArg,
    makeSchema,
    objectType,
  } from 'nexus'
```

Next, use the Nexus `objectType` function to create new GraphQL types for `User` and `Post`, then use `resolve` to map these to the corresponding Prisma types:

```
  const Post = objectType({
    name: 'Post',
    definition(t) {
      t.nonNull.int('id')
      t.nonNull.string('title')
      t.string('content')
      t.field('author', {
        type: 'User',
        resolve: (parent, _, context: Context) => {
          return context.prisma.post
            .findUnique({
              where: { id: parent.id || undefined },
            })
            .author()
        },
      })
    },
  })  
  
  const User = objectType({
    name: 'User',
    definition(t) {
      t.nonNull.int('id')
      t.string('name')
      t.nonNull.string('email')
      t.nonNull.list.nonNull.field('posts', {
        type: 'Post',
        resolve: (parent, _, context: Context) => {
          return context.prisma.user
            .findUnique({
              where: { id: parent.id || undefined },
            })
            .posts()
        },
      })
    },
  })
```
You'll also need a GraphQL `Query` type. For this example, you'll create a `'feed' ` query that displays a list of posts. This query takes in three arguments, `skip`, `take` and `cursor`, which correspond to the Prisma pagination options discussed in the [What is cursor-based pagination?](#what-is-cursor-based-pagination) section above.

```ts
  const Query = objectType({
  name: 'Query',
  definition(t) {
    t.nonNull.list.nonNull.field('offsetPagination', {
      type: 'Post',
      args: {
        skip: intArg(),
        take: intArg(),
      },
      resolve: (_parent, args, context: Context) => {
        return context.prisma.post.findMany({
          skip: args.skip || undefined,
          take: args.take || undefined,
        })
      },
    })

    t.nonNull.list.nonNull.field('cursorPagination', {
      type: 'Post',
      args: {
        skip: intArg(),
        take: intArg(),
        cursor: intArg(),
      },
      resolve: (_parent, args, context: Context) => {
        return context.prisma.post.findMany({
          skip: args.skip || undefined,
          take: args.take || undefined,
          cursor: {
            id: args.cursor || undefined,
          },
        })
      },g
    }) 
    
  },
})

```


Finally, include the following code to create and export the schema:
```
  export const schema = makeSchema({
    types: [
      Query,
      Post,
      User
    ],
    outputs: {
      schema: __dirname + '/../schema.graphql',
      typegen: __dirname + '/generated/nexus.ts',
    },
    contextType: {
      module: require.resolve('./context'),
      export: 'Context',
    },
    sourceTypes: {
      modules: [
        {
          module: '@prisma/client',
          alias: 'prisma',
        },
      ],
    },
  })
```

## Example project: Querying the GraphQL API

You're now ready to start your GraphAPI server and run some queries. Add the following line to the `scripts` section of your `package.json` file:

```diff
  "scripts": {
+    "dev": "ts-node-dev --no-notify --respawn --transpile-only server",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
```

Now run: 

```
npm run dev
```
This will get the Apollo server up and running. Go to [http:\\localhost:4000](localhost:4000), which will redirect you to the Apollo Studio Explorer:

![Apollo Studio Explorer start screen](./images/server-splash-screen.png)

Select 'Query your server', and then enter the following example query in the Operations tab:

```graphql
query Query {
  offsetPagination(skip: 0, take: 3) {
    id
    title
    content
  }
}
```
This uses offset pagination to return the first three posts:

!!

!!add image

!!

Now query again using cursor-based pagination to get the next three posts. To do this, pass the `id` of the final post in the list to the `cursor` parameter. Then `skip` one post to start from the next one:

```graphql
query Query {
  cursorPagination(skip: 1, take: 3, cursor: 6) {
    id
    title
    content
  }
}
```
This returns the following posts:

!!

!!add image

!!

You can now use the query explorer to play with this example further. Use Prisma's [GraphQL Server Example](https://github.com/prisma/prisma-examples/tree/latest/typescript/graphql) for ideas on how to add further queries.