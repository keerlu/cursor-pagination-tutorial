import { Context } from './context'
import {
    intArg,
    makeSchema,
    objectType,
  } from 'nexus'

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
      },
    }) 
    
  },
})

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
